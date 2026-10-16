import { LruCache } from '../shared/lruCache'
import { lazyFrameUrls } from './frameUrls'
import { petQuotaIndex } from '../shared/petQuota'
import manifest from './atlas-manifest.json'
import type { Scene } from '../shared/types'
export interface AwakeningAtlas { file: string; name: string; size: number[]; rects: number[][] }
export const AWAKENING_ATLASES: Record<string, AwakeningAtlas> = manifest
export function awakeningAtlas(scene: Scene, skin: string, form = 'chibi') {
  return AWAKENING_ATLASES[`${scene}/${skin}${scene === 'skadi' ? '/' + form : ''}`]
}
/** Unknown quota uses a neutral/tired pose, never the full-energy pose. */
export function energyFrame(percent: number | null, count: number) {
  if (percent === null || !Number.isFinite(percent)) return Math.min(1, count - 1)
  return petQuotaIndex(percent,count)!
}
// Neighboring atlas cells can leave tiny disconnected edge fragments. Remove
// only small edge components, keeping the complete main figure and interior detail.
export function clearEdgeSpecks(canvas: HTMLCanvasElement, maxFraction = .025) {
  const ctx=canvas.getContext('2d')!, w=canvas.width,h=canvas.height,pixels=ctx.getImageData(0,0,w,h),d=pixels.data
  const seen=new Uint8Array(w*h), components:{points:number[];edge:boolean}[]=[]
  for(let start=0;start<w*h;start++){
    if(seen[start]||d[start*4+3]!<64)continue
    const points=[start];seen[start]=1;let edge=false
    for(let at=0;at<points.length;at++){
      const i=points[at]!,x=i%w,y=Math.floor(i/w);edge ||= x<4||y<4||x>=w-4||y>=h-4
      for(const next of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1]){
        if(next<0||seen[next]||d[next*4+3]!<64)continue;seen[next]=1;points.push(next)
      }
    }
    components.push({points,edge})
  }
  const largest=Math.max(0,...components.map(c=>c.points.length))
  for(const c of components)if(c.edge&&c.points.length<largest*maxFraction){
    for(const i of c.points){d[i*4+3]=0;const x=i%w,y=Math.floor(i/w)
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h){const alpha=(yy*w+xx)*4+3;if(d[alpha]!<64)d[alpha]=0}}
    }
  }
  ctx.putImageData(pixels,0,0)
}

export interface AwakenedArt { cinematic?: boolean; frames: HTMLCanvasElement[]; urls: string[]; trimmed: HTMLCanvasElement[]; packed: string }
const sheets = new LruCache<string, Promise<HTMLImageElement>>(4)
const cache = new LruCache<string, Promise<AwakenedArt>>(12)
export function loadAwakenedArt(scene: Scene, skin: string, form = 'chibi'): Promise<AwakenedArt> {
  const key = `${scene}/${skin}/${form}`, spec = awakeningAtlas(scene, skin, form)
  if (!spec) return Promise.reject(new Error(`No awakening art: ${key}`))
  const previous = cache.get(key); if (previous) return previous
  let sheet = sheets.get(spec.file)
  if (!sheet) {
    sheet = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error(`Awakening atlas failed: ${spec.file}`))
      img.src = `./assets/evolution/v2/${spec.file}`
    }); sheets.set(spec.file, sheet)
    void sheet.catch(() => { if (sheets.get(spec.file) === sheet) sheets.delete(spec.file) })
  }
  const pending = sheet.then(image => {
    // One scale per costume, with a shared ground line. Lying poses stay short.
    const scale = Math.min(448 / Math.max(...spec.rects.map(r => r[2]!)), 448 / Math.max(...spec.rects.map(r => r[3]!)))
    const trimmed = spec.rects.map(([x,y,w,h]) => {
      const c=document.createElement('canvas'); c.width=w!;c.height=h!
      c.getContext('2d')!.drawImage(image,x!,y!,w!,h!,0,0,w!,h!);clearEdgeSpecks(c);return c
    })
    const frames = trimmed.map(c => {
      const out=document.createElement('canvas');out.width=out.height=512
      out.getContext('2d')!.drawImage(c,(512-c.width*scale)/2,480-c.height*scale,c.width*scale,c.height*scale);return out
    })
    let packed = ''
    if(scene==='cultivation') {
      const atlas=document.createElement('canvas');atlas.width=1536;atlas.height=1024
      frames.forEach((c,i)=>atlas.getContext('2d')!.drawImage(c,i%3*512,Math.floor(i/3)*512));packed=atlas.toDataURL()
    }
    return {frames,trimmed:scene==='aquarium'?trimmed:[],urls:lazyFrameUrls(frames),packed}
  })
  cache.set(key,pending)
  // Bound decoded per-costume buffers during wardrobe browsing.
  void pending.catch(()=>{if(cache.get(key)===pending)cache.delete(key)})
  return pending
}
