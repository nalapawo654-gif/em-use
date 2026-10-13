"""Author the original EM Use intro. Optional tooling: Pillow + imageio-ffmpeg.
No network/assets/font files are shipped: the chosen system font is rasterized.
Usage: python render-startup.py --font /path/to/serif.ttf [--ffmpeg /path/to/ffmpeg]
"""
from pathlib import Path
import argparse, math, random, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

parser = argparse.ArgumentParser()
parser.add_argument('--font', required=True)
parser.add_argument('--ffmpeg')
parser.add_argument('--preview', help='Optional keyframe PNG output path')
args = parser.parse_args()
if not args.ffmpeg:
    import imageio_ffmpeg
    args.ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
root = Path(__file__).resolve().parents[1] / 'public/startup'
root.mkdir(parents=True, exist_ok=True)
W,H,FPS,SECONDS = 1280,720,30,3
rng = random.Random(20261013)
font = ImageFont.truetype(args.font, 96)
base = Image.new('RGB',(W,H))
pixels=base.load()
for y in range(H):
    for x in range(W):
        r=math.sqrt(((x-W/2)/650)**2+((y-H*.45)/370)**2)
        light=max(0,1-r)**2
        pixels[x,y]=(int(7+7*light),int(23+25*light),int(24+22*light))
# Deliberate, faint orbital engraving in the background.
d=ImageDraw.Draw(base)
for radius in (245,251,348,352,445):
    d.ellipse((W/2-radius,H*.40-radius,W/2+radius,H*.40+radius),outline=(20,43,40),width=1)
for x,y in [(48,48),(W-48,48),(48,H-48),(W-48,H-48)]:
    sx=1 if x<W/2 else -1; sy=1 if y<H/2 else -1
    d.line([(x+sx*18,y),(x,y),(x,y+sy*18)],fill=(67,88,72),width=1)
stars=[(rng.uniform(60,W-60),rng.uniform(80,H-80),rng.uniform(.4,1.6),rng.random()) for _ in range(150)]
# A little fish made from two flowing arcs, our own emblem rather than a vendor logo.
def bezier(points,n=90):
    out=[]
    for i in range(n):
        t=i/(n-1);u=1-t
        out.append((u**3*points[0][0]+3*u*u*t*points[1][0]+3*u*t*t*points[2][0]+t**3*points[3][0],u**3*points[0][1]+3*u*u*t*points[1][1]+3*u*t*t*points[2][1]+t**3*points[3][1]))
    return out
paths=[bezier([(-92,8),(-31,-78),(58,-66),(96,-3)]),bezier([(96,-3),(34,61),(-31,73),(-92,8)]),[(-83,9),(-123,-26),(-112,11),(-126,42),(-83,9)],bezier([(-55,8),(-4,-18),(19,34),(65,9)])]
outline=[p for path in paths for p in path]
particles=[(x,y,size,phase,outline[int(phase*(len(outline)-1))]) for x,y,size,phase in stars]
def ease(t):
    t=max(0,min(1,t)); return t*t*(3-2*t)
def draw(t):
    frame=base.copy();layer=Image.new('RGBA',(W,H)); ink=ImageDraw.Draw(layer)
    arrival=ease((t-.12)/.95)
    center=(640,255)
    fade=1-ease((t-2.65)/.35)
    for x,y,size,phase,(tx,ty) in particles:
        mix=arrival
        px=x+(center[0]+tx-x)*mix;py=y+(center[1]+ty-y)*mix
        alpha=int((60+150*arrival)*fade*(1-ease((t-1.2)/.4)))
        ink.ellipse((px-size,py-size,px+size,py+size),fill=(231,202,136,alpha))
        if t<1.1 and arrival>0.05:
            ink.line((px,py,px+(x-px)*.04,py+(y-py)*.04),fill=(188,175,125,alpha//3),width=1)
    appear=ease((t-.65)/.6)*fade
    # Soft halo is pre-rendered, never a live WebGL or blur effect.
    for path in paths:
        pts=[(center[0]+x,center[1]+y) for x,y in path]
        ink.line(pts,fill=(182,207,169,int(170*appear)),width=7,joint='curve')
    halo=layer.filter(ImageFilter.GaussianBlur(13))
    frame=Image.alpha_composite(frame.convert('RGBA'),halo)
    frame=Image.alpha_composite(frame,layer)
    layer=Image.new('RGBA',(W,H));ink=ImageDraw.Draw(layer)
    for path in paths:
        ink.line([(center[0]+x,center[1]+y) for x,y in path],fill=(235,216,171,int(255*appear)),width=2,joint='curve')
    ink.ellipse((696,242,702,248),fill=(246,232,201,int(255*appear)))
    # One expanding ripple and small satellite stars, then a still hold.
    ripple=ease((t-.8)/1.1);radius=125+55*ripple
    ink.ellipse((640-radius,255-radius*.58,640+radius,255+radius*.58),outline=(139,178,151,int(75*(1-ripple)*fade)),width=1)
    for angle in (0.25,2.7,4.2):
        x=640+178*math.cos(angle);y=255+115*math.sin(angle)
        a=int(170*appear)
        ink.line((x-5,y,x+5,y),fill=(215,196,140,a));ink.line((x,y-5,x,y+5),fill=(215,196,140,a))
    title=ease((t-1.0)/.6)*fade
    label='EM USE';spacing=12
    widths=[ink.textlength(c,font=font) for c in label];x=(W-sum(widths)-spacing*(len(label)-1))/2
    y=351+10*(1-ease((t-1.0)/.6))
    for c,width in zip(label,widths):
        ink.text((x,y),c,font=font,fill=(231,234,211,int(255*title)));x+=width+spacing
    return Image.alpha_composite(frame,layer).convert('RGB')
draw(0).save(root/'poster.jpg',quality=90)
cmd=[args.ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','slow','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',str(root/'awakening.mp4')]
proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
for i in range(FPS*SECONDS): proc.stdin.write(draw(i/FPS).tobytes())
proc.stdin.close();errors=proc.stderr.read();proc.wait()
if proc.returncode: raise RuntimeError(errors.decode())
print('Generated',root/'awakening.mp4',(root/'awakening.mp4').stat().st_size,'bytes')
if args.preview: draw(1.9).save(args.preview)
