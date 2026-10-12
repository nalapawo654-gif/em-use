import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createFrameLoop } from '../public/worlds/deskworlds/scenes/shared/frame-loop.js';

test('paused riverbed stops scheduling work and resumes without simulating suspended time', () => {
  const queue = new Map(); let id = 0, time = 0; const frames = [];
  const loop = createFrameLoop(dt => frames.push(dt), {
    fps: 30, clock: () => time,
    requestFrame: fn => { queue.set(++id, fn); return id }, cancelFrame: key => queue.delete(key),
    delay: fn => { queue.set(++id, fn); return id }, cancelDelay: key => queue.delete(key),
  });
  const flush = () => { const pending = [...queue.values()]; queue.clear(); for (const fn of pending) fn(time) };
  flush(); assert.equal(frames.length, 1);
  loop.setPaused(true); assert.equal(queue.size, 0); assert.equal(loop.state.running, false);
  time = 60_000; loop.setPaused(false); flush(); flush();
  assert.equal(frames.at(-1), 0);
  loop.setHidden(true); assert.equal(queue.size, 0);
  loop.setHidden(false); loop.dispose(); assert.equal(queue.size, 0);
  loop.setRate(60); assert.equal(queue.size, 0);
});

test('the packaged riverbed module graph resolves locally without inline import maps or remote modules', async () => {
  const root = new URL('../public/worlds/deskworlds/', import.meta.url);
  async function check(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) { await check(url); continue }
      if (!entry.name.endsWith('.js')) continue;
      const source = await readFile(url, 'utf8');
      for (const [, path] of source.matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
        assert.ok(path.startsWith('.'), `${url.pathname}: ${path}`);
        await stat(new URL(path, url));
      }
    }
  }
  await check(root);
  const page = await readFile(new URL('../world.html', import.meta.url), 'utf8');
  assert.ok(!page.includes('importmap'));
  assert.match(await readFile(new URL('LICENSE', root), 'utf8'), /Copyright \(c\) 2026 Chase Lean/);
  assert.match(await readFile(new URL('vendor/THREE-LICENSE.txt', root), 'utf8'), /MIT License/);
});
