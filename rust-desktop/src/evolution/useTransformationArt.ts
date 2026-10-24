import { computed, getCurrentInstance, onMounted, onScopeDispose, ref, shallowReactive, shallowRef, watch, type ComputedRef } from 'vue'
import { appState, quotaDisplay } from '../bridge'
import type { Scene } from '../shared/types'
import { type AwakenedArt } from './atlas'
import { evolution, evolutionHidden, evolutionMotion } from './controller'
import { setEvolutionCinematic, setEvolutionLoading } from './readiness'
import { createTransformationRenderer, loadTransformation, transformationKey, transformationEndFrame } from './transformation'
const failures=shallowReactive(new Map<symbol,()=>Promise<void>>())
export const transformationAssetFailed=computed(()=>failures.size>0)
export function retryTransformationArt(){for(const retry of [...failures.values()])void retry()}

/** Reuse each actor's placement and scene renderer. Only the live actor opts in;
 * wardrobe cards and quota samples must not load or run a ceremony. */
export function useTransformationArt(scene:Scene,skin:()=>string,form:()=>string,prepared:ComputedRef<AwakenedArt|undefined>,pose?:()=>number){
  const instance=getCurrentInstance(),main=ref(false),readyKey=ref(''),poses=shallowRef<HTMLCanvasElement[]>(),art=shallowRef<AwakenedArt>()
  const key=computed(()=>transformationKey(scene,skin(),form())),owner=Symbol('transformation-'+scene)
  let disposed=false,revision=0,raf=0,last=0,widget:HTMLElement|undefined,draw:ReturnType<typeof createTransformationRenderer>|undefined
  const output=document.createElement('canvas');output.width=output.height=512
  const trimmed=document.createElement('canvas');trimmed.width=trimmed.height=448
  const active=computed(()=>main.value&&scene!=='dinosaur'&&evolution.scene===scene&&readyKey.value===key.value&&!!poses.value&&!!prepared.value&&evolution.phase!=='idle'&&evolutionMotion.value==='full'&&!evolutionHidden.value&&(evolution.source==='codex'||evolution.kind==='source'))
  async function load(){
    const ticket=++revision;failures.delete(owner)
    if(!main.value||scene==='dinosaur'||!appState.settings.codexEnabled){setEvolutionLoading(owner,false);return}
    setEvolutionLoading(owner,true)
    try{const next=await loadTransformation(scene,skin(),form());if(disposed||ticket!==revision)return;poses.value=next;draw=createTransformationRenderer(scene,skin(),next);readyKey.value=key.value}
    catch{if(!disposed&&ticket===revision){readyKey.value='';failures.set(owner,load)}}
    finally{if(!disposed&&ticket===revision)setEvolutionLoading(owner,false)}
  }
  let returnTarget:HTMLCanvasElement|undefined
  watch(()=>[prepared.value,quotaDisplay.value.percent,pose?.()],()=>{const base=prepared.value;if(base&&appState.settings.quotaSource==='codex')returnTarget=base.frames[pose?.()??transformationEndFrame(scene,quotaDisplay.value.percent,base.frames.length)]},{immediate:true})
  function tick(now:number){
    if(disposed||!active.value||!prepared.value||!draw)return
    if(now-last>=1000/30){
      last=now;const base=prepared.value,reverse=evolution.kind==='source'&&evolution.source!=='codex',target=(reverse?returnTarget:undefined)??base.frames[pose?.()??transformationEndFrame(scene,quotaDisplay.value.percent,base.frames.length)]!
      const time=draw(output.getContext('2d')!,now-evolution.started,evolution.duration,target,evolution.kind==='source'&&evolution.source!=='codex')
      const ctx=trimmed.getContext('2d')!;ctx.clearRect(0,0,448,448);ctx.drawImage(output,32,32,448,448,0,0,448,448)
      // Canvas consumers share the buffer; DOM consumers receive one 30fps image.
      const url=['hermit','fox','piranha','potato','skadi','cultivation'].includes(scene)?output.toDataURL():''
      art.value={frames:Array.from({length:base.frames.length},()=>output),trimmed:Array.from({length:base.frames.length},()=>trimmed),urls:Array.from({length:base.frames.length},()=>url),packed:base.packed,cinematic:true}
      if(widget){widget.dataset.transformationScene=scene;widget.dataset.transformationBeat=time.beat;widget.dataset.transformationProgress=time.progress.toFixed(3)}
    }
    raf=requestAnimationFrame(tick)
  }
  function schedule(){cancelAnimationFrame(raf);setEvolutionCinematic(owner,active.value);last=-Infinity
    if(active.value)tick(performance.now());else{art.value=undefined;if(widget){delete widget.dataset.transformationScene;delete widget.dataset.transformationBeat;delete widget.dataset.transformationProgress}}
  }
  watch(()=>[key.value,main.value,appState.settings.codexEnabled],load,{flush:'sync'})
  watch(()=>[active.value,evolution.started],schedule,{flush:'sync'})
  onMounted(()=>{
    const node=instance?.proxy?.$el as Node|undefined,el=node instanceof Element?node:node?.parentElement
    const host=el?.closest(`.${scene}-widget,.widget`)
    if(host instanceof HTMLElement&&!el?.closest('[role="dialog"],button:not(.scene-hit)')){widget=host;main.value=true}
  })
  onScopeDispose(()=>{disposed=true;revision++;cancelAnimationFrame(raf);setEvolutionLoading(owner,false);setEvolutionCinematic(owner,false);failures.delete(owner);if(widget){delete widget.dataset.transformationScene;delete widget.dataset.transformationBeat;delete widget.dataset.transformationProgress}})
  return {art,active}
}
