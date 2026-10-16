async(page)=>{
 await page.goto('http://127.0.0.1:5174/tests/fixtures/evolution-harness.html');const f=page.frames()[1];await f.waitForFunction(()=>!!window.__evolutionQa);const errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));await page.mouse.move(1100,850)
 const sample=(patch,ms)=>f.evaluate(async({patch,ms})=>{
  const q=window.__evolutionQa,rows=[];q.settings(patch);const start=performance.now();await new Promise(resolve=>{function tick(){const host=document.querySelector('[data-transformation-scene]'),surface=document.querySelector('.evolution-surface'),actor=document.querySelector('[data-cinematic="true"]');rows.push({beat:host?.dataset.transformationBeat,phase:surface?.dataset.phase,awake:surface?.dataset.evolution,ring:!!document.querySelector('.evolution-ring'),animation:actor?getComputedStyle(actor).animationName:null});if(performance.now()-start>=ms)resolve();else requestAnimationFrame(tick)}requestAnimationFrame(tick)});return {beats:[...new Set(rows.map(r=>r.beat).filter(Boolean))],animations:[...new Set(rows.filter(r=>r.beat).map(r=>r.animation))],ringDuringCinema:rows.some(r=>r.beat&&r.ring),last:rows.at(-1),errors:[...document.querySelectorAll('.awakening-load-error')].map(e=>e.textContent),percent:q.state.codex.buckets[0].windows[0].remainingPercent}
 },{patch,ms})
 for(const scene of ['fox','piranha','luckycat','buddy','feidudu','beaver','hamster','cultivation','battery','aquarium','skadi','potato']){
  await f.evaluate(scene=>{window.__evolutionQa.quota(40);window.__evolutionQa.settings({scene,cultivationRandom:false,quotaSource:'eastmoney',reducedMotion:false,evolutionMotion:'off'})},scene);await page.waitForTimeout(1500)
  const forward=await sample({quotaSource:'codex',evolutionMotion:'full'},2200)
  if(forward.beats.length!==4||forward.ringDuringCinema||forward.last.beat||forward.errors.length||forward.percent!==40)throw Error(JSON.stringify({scene,forward}))
  await page.locator('#pet').screenshot({path:`output/playwright/cinematic-${scene}-190-end.png`})
  const reverse=await sample({quotaSource:'eastmoney'},800);if(reverse.beats.length<3||reverse.last.beat||reverse.last.awake!=='original')throw Error(JSON.stringify({scene,reverse}))
  const light=await sample({quotaSource:'codex',evolutionMotion:'light'},350);if(light.beats.length||light.last.phase!=='idle')throw Error(JSON.stringify({scene,light}))
  results.push({scene,forward,reverse,light})
 }
 if(errors.length)throw Error(JSON.stringify(errors));return{results,errors}
}
