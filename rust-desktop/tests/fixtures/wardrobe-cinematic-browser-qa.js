async(page)=>{
 const f=page.frames()[1];
 // The CLI VM has no process globals; replace __BATCH__ before invocation.
 const start=__BATCH__*21,end=start+21
 const entries=await f.evaluate(async()=>Object.keys((await import('/src/evolution/transformation.ts')).TRANSFORMATION_ATLASES))
 const results=[]
 await page.locator('#pet').evaluate(e=>{e.style.width='440px';e.style.height='440px'})
 for(const key of entries.slice(start,end)){
  const result=await f.evaluate(async key=>{
   const [scene,skin,form]=key.split('/'),q=window.__evolutionQa,patch={scene,quotaSource:'codex',evolutionMotion:'full',reducedMotion:false,cultivationRandom:false}
   if(scene==='skadi'){patch.skadiForm=form;patch[form==='adult'?'skadiAdultSkin':'skadiSkin']=skin}else patch[scene==='aquarium'?'outfit':scene+'Skin']=skin
   q.quota(0);q.settings(patch);const begin=performance.now(),beats=new Set();let played=false,frames=0,ring=false
   await new Promise(resolve=>{function tick(){const host=document.querySelector('[data-transformation-scene]'),surface=document.querySelector('.evolution-surface');if(host){played=true;frames++;beats.add(host.dataset.transformationBeat);ring||=!!document.querySelector('.evolution-ring')}if((played&&surface?.dataset.phase==='idle')||performance.now()-begin>6500)resolve();else requestAnimationFrame(tick)}requestAnimationFrame(tick)})
   return {key,beats:[...beats],frames,ring,elapsed:Math.round(performance.now()-begin),percent:q.state.codex.buckets[0].windows[0].remainingPercent,error:document.querySelector('.awakening-load-error')?.textContent,remaining:!!document.querySelector('[data-transformation-scene]'),skin:document.querySelector('.evolution-actor')?.dataset.awakeningSkin}
  },key)
  results.push(result);if(result.beats.length!==4||result.ring||result.error||result.remaining||result.percent!==0)throw Error(JSON.stringify({results}))
 }
 return {start,end:Math.min(end,entries.length),results}
}
