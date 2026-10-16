import { AWAKENING_ATLASES, loadAwakenedArt } from '../../src/evolution/atlas'
import type { Scene } from '../../src/shared/types'
const main=document.querySelector('main')!, filter=new URLSearchParams(location.search).get('scene')
let count=0
for(const [key,spec] of Object.entries(AWAKENING_ATLASES)){
 const [scene,skin,form]=key.split('/')
 if(filter && scene!==filter)continue
 const h=document.createElement('h2');h.textContent=`${key} · ${spec.name}`;main.append(h)
 const row=document.createElement('section');row.dataset.key=key;main.append(row)
 try{
  const art=await loadAwakenedArt(scene as Scene,skin!,form)
  for(const [i,src] of art.urls.entries()){
   const figure=document.createElement('figure'),img=new Image(),caption=document.createElement('figcaption')
   img.src=src;caption.textContent=`状态 ${i+1}`;figure.append(img,caption);row.append(figure);count++
  }
 }catch(e){row.textContent=String(e);row.dataset.error='true'}
}
document.querySelector('#summary')!.textContent=`已加载 ${count} 帧 · ${main.querySelectorAll('[data-error]').length} 处加载失败`
document.body.dataset.ready='true'
