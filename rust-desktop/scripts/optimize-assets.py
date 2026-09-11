"""Lossless runtime artwork conversion; originals remain in the Electron baseline."""
import argparse, hashlib, json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'public/assets'
DEST = ROOT / 'public/assets'
REPORT = ROOT / 'docs/asset-compression.json'
UNUSED = {
    'cultivation/cultivator.png': 'Replaced by cultivation/skins atlases',
    'beaver/quota-trees.png': 'Replaced by quota-trees-v2.png',
    'beaver/quota-heads.png': 'Replaced by dressed-heads skin atlases',
    'beaver/fitted-hats.png': 'Replaced by integrated dressed artwork',
    'beaver/fitted-clothes.png': 'Replaced by integrated dressed artwork',
    'hamster/run-cycle.png': 'Replaced by dressed and corrected animation atlases',
    'hamster/wardrobe.png': 'Replaced by integrated dressed artwork',
}
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
PREVIOUS = json.loads(REPORT.read_text())['images'] if REPORT.exists() else []
CACHE = {r['source']: r for r in PREVIOUS}
def convert(source):
    relative = source.relative_to(SOURCE).as_posix()
    with Image.open(source) as image:
        # PNG/WebP decoders round premultiplied alpha differently in browser compositing.
        # Keep transparent atlases as optimized PNG to preserve exact rendered edges.
        transparent = 'A' in image.getbands() and image.getchannel('A').getextrema() != (255, 255)
        target = DEST / Path(relative).with_suffix('.png' if transparent else '.webp')
        target.parent.mkdir(parents=True, exist_ok=True)
        cached = CACHE.get(relative)
        if cached and target.exists() and cached['target'] == target.relative_to(DEST).as_posix() and digest(source) == cached['source_sha256'] and digest(target) == cached['sha256']:
            return cached
        if image.info: raise ValueError('Review image metadata before conversion: ' + relative)
        if transparent:
            image.save(target, format='PNG', optimize=True, compress_level=9)
        else:
            image.save(target, format='WEBP', lossless=True, exact=True, quality=100, method=6)
        with Image.open(target) as result:
            assert image.size == result.size
            assert image.convert('RGBA').tobytes() == result.convert('RGBA').tobytes(), relative
        return dict(source=relative, target=target.relative_to(DEST).as_posix(), width=image.width,
                    height=image.height, source_bytes=source.stat().st_size, bytes=target.stat().st_size,
                    source_sha256=digest(source), sha256=digest(target), different_pixels=0)
def verify():
    report = json.loads(REPORT.read_text())
    originals = {p.relative_to(SOURCE).as_posix() for p in SOURCE.rglob('*.png')}
    assert originals == {r['source'] for r in report['images']} | set(UNUSED), 'Unreviewed source artwork'
    assert report['excluded'] == UNUSED
    expected = {r['target'] for r in report['images']}
    assert {p.relative_to(DEST).as_posix() for p in DEST.rglob('*') if p.is_file()} == expected, 'Unexpected runtime assets'
    for row in report['images']:
        source, target = SOURCE / row['source'], DEST / row['target']
        assert digest(source) == row['source_sha256'] and digest(target) == row['sha256'], row['source']
        with Image.open(source) as a, Image.open(target) as b:
            assert a.size == b.size == (row['width'], row['height'])
            assert a.convert('RGBA').tobytes() == b.convert('RGBA').tobytes(), row['source']
    print(f"{len(expected)} runtime atlases: identical dimensions and every RGBA pixel; {report['runtime_bytes']:,} bytes")
if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--check', action='store_true'); args = parser.parse_args()
    if not args.check:
        sources = sorted(p for p in SOURCE.rglob('*.png') if p.relative_to(SOURCE).as_posix() not in UNUSED)
        with ThreadPoolExecutor(max_workers=4) as pool: rows = list(pool.map(convert, sources))
        # Remove only unchanged mirrored originals; authoring material stays in the baseline.
        expected = {r['target'] for r in rows}
        for path in sorted(DEST.rglob('*')):
            if path.is_file() and path.relative_to(DEST).as_posix() not in expected:
                relative = path.relative_to(DEST).as_posix()
                original = SOURCE / relative
                is_original = original.is_file() and path.read_bytes() == original.read_bytes()
                is_previous = any(r['target'] == relative and r['sha256'] == digest(path) for r in PREVIOUS)
                assert is_original or is_previous, str(path)
                path.unlink()
        REPORT.write_text(json.dumps(dict(encoding='Opaque: WebP lossless, exact=True. Transparent: optimized PNG for browser compositing parity.', excluded=UNUSED, images=rows,
            original_png_bytes=sum(p.stat().st_size for p in SOURCE.rglob('*.png')),
            runtime_bytes=sum(r['bytes'] for r in rows)), indent=2) + '\n')
    verify()
