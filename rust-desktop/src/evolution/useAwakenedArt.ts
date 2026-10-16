import { useTransformationArt } from './useTransformationArt'
import { computed, onScopeDispose, ref, shallowRef, shallowReactive, watch } from 'vue'
import type { Scene } from '../shared/types'
import { appState } from '../bridge'
import { setEvolutionLoading } from './readiness'
import { evolution } from './controller'
import { loadAwakenedArt, type AwakenedArt } from './atlas'
const failures=shallowReactive(new Map<symbol,()=>Promise<void>>())
export const awakeningAssetFailed=computed(()=>failures.size>0)
export function retryAwakeningArt(){for(const retry of [...failures.values()])void retry()}
export function useAwakenedArt(scene: Scene, skin: () => string, form: () => string = () => 'chibi', pose?:()=>number) {
  const loaded=shallowRef<AwakenedArt>(), loadedKey=ref(''), failed=ref(false)
  const key=computed(()=>`${skin()}/${form()}`)
  const owner=Symbol(scene)
  let revision=0,disposed=false
  async function load(){
    const ticket=++revision, selected=key.value;failed.value=false;failures.delete(owner)
    if(!appState.settings.codexEnabled&&!evolution.awake){setEvolutionLoading(owner,false);return}
    setEvolutionLoading(owner,true)
    try{const value=await loadAwakenedArt(scene,skin(),form());if(!disposed&&ticket===revision){loaded.value=value;loadedKey.value=selected}}
    catch{if(!disposed&&ticket===revision){failed.value=true;failures.set(owner,load)}}
    finally{if(!disposed&&ticket===revision)setEvolutionLoading(owner,false)}
  }
  watch(()=>[key.value,appState.settings.codexEnabled],load,{immediate:true})
  onScopeDispose(()=>{disposed=true;revision++;failures.delete(owner);setEvolutionLoading(owner,false)})
  const prepared=computed(()=>loadedKey.value===key.value?loaded.value:undefined)
  const ceremony=useTransformationArt(scene,skin,form,prepared,pose)
  return {cinematic:ceremony.active,art:computed(()=>ceremony.art.value ?? (evolution.awake&&(loadedKey.value===key.value||!failed.value)?loaded.value:undefined)),prepared,failed,retry:load}
}
