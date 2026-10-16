async(page)=>{
 const f=page.frames()[1],errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));await page.mouse.move(1000,700)
 const sample=(patch,ms)=>f.evaluate(async({patch,ms})=>{
  const qa=window.__evolutionQa,rows=[];qa.settings(patch)
  const start=performance.now();await new Promise(resolve=>{
   function tick(){const c=document.querySelector('.dinosaur-sprite'),surface=document.querySelector('.evolution-surface');if(c&&surface){
    const a=c.getContext('2d').getImageData(0,0,512,512).data;let sum=0;for(let i=3;i<a.length;i+=4092)sum+=a[i]
    rows.push({beat:c.dataset.transformationBeat,phase:surface.dataset.phase,progress:c.dataset.transformationProgress,animation:getComputedStyle(c).animationName,ring:!!document.querySelector('.evolution-ring'),alpha:sum,awake:surface.dataset.evolution})
   }if(performance.now()-start>=ms)resolve();else requestAnimationFrame(tick)}requestAnimationFrame(tick)
  });return {beats:[...new Set(rows.map(r=>r.beat).filter(Boolean))],animations:[...new Set(rows.filter(r=>r.beat).map(r=>r.animation))],ringDuringCinema:rows.some(r=>r.beat&&r.ring),last:rows.at(-1),percent:qa.state.codex.buckets[0].windows[0].remainingPercent}
 },{patch,ms})
 for(const size of [190,440])for(const skin of ['classic','peach','cream','charcoal']){
  await page.locator('#pet').evaluate((e,size)=>{e.style.width=size+'px';e.style.height=size+'px'},size)
  await f.evaluate(skin=>{window.__evolutionQa.quota(40);window.__evolutionQa.settings({scene:'dinosaur',dinosaurSkin:skin,quotaSource:'eastmoney',reducedMotion:false,evolutionMotion:'off'})},skin)
  await f.waitForFunction(()=>document.querySelector('.dinosaur-visual')?.dataset.loaded==='true')
  const result=await sample({quotaSource:'codex',evolutionMotion:'full'},2300)
  if(result.beats.length!==4||result.ringDuringCinema||result.last.beat||result.percent!==40||result.last.alpha===0||result.animations.some(a=>a!=='none'))throw new Error(JSON.stringify({skin,size,result}))
  await page.locator('#pet').screenshot({path:`output/playwright/dinosaur-cinematic-${skin}-${size}-end.png`});results.push({skin,size,...result})
 }
 const reverse=await sample({quotaSource:'eastmoney'},850)
 const light=await sample({quotaSource:'codex',evolutionMotion:'light'},350)
 if(light.beats.length||reverse.last.beat||reverse.last.awake!=='original')throw new Error('Return/light cleanup failed')
 await f.evaluate(()=>window.__evolutionQa.settings({quotaSource:'eastmoney',evolutionMotion:'off'}))
 await f.evaluate(()=>window.__evolutionQa.settings({quotaSource:'codex',evolutionMotion:'full'}))
 await f.waitForFunction(()=>!!document.querySelector('canvas[data-transformation-beat]'))
 const interrupted=await sample({evolutionMotion:'off'},350)
 if(interrupted.beats.length||interrupted.last.phase!=='idle')throw new Error('Interrupted animation remains')
 const wardrobe=await sample({dinosaurSkin:'classic',evolutionMotion:'full'},2100)
 if(wardrobe.beats.length!==4)throw new Error('Wardrobe misses cinematic')
 if(errors.length)throw new Error(JSON.stringify(errors))
 return {results,reverse,light,interrupted,wardrobe,errors}
}
