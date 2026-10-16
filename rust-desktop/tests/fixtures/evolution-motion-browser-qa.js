// Run through playwright-cli on evolution-harness.html. Uses demo state only.
async (page) => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const f=page.frames()[1],results=[];
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.mouse.move(1000,700);
 await page.locator('#pet').evaluate(e=>{e.style.width='440px';e.style.height='440px'});
 await f.waitForFunction(()=>window.__evolutionQa);
 await f.evaluate(()=>window.__evolutionQa.settings({scene:'skadi',evolutionMotion:'off'}));
 const sample=async(patch,ms)=>f.evaluate(async({patch,ms})=>{
  const qa=window.__evolutionQa;qa.quota(80);qa.settings(patch);
  const samples=[],start=performance.now();
  await new Promise(resolve=>{
   function tick(){
    const actor=document.querySelector('.evolution-actor'),surface=document.querySelector('.evolution-surface');
    if(actor&&surface){const style=getComputedStyle(actor);samples.push({phase:surface.dataset.phase,awake:surface.dataset.evolution,animation:style.animationName,opacity:Number(style.opacity),clip:style.clipPath})}
    if(performance.now()-start>=ms)resolve();else requestAnimationFrame(tick)
   }requestAnimationFrame(tick)
  });
  return {phases:[...new Set(samples.map(s=>s.phase))],animations:[...new Set(samples.map(s=>s.animation))],minOpacity:Math.min(...samples.map(s=>s.opacity)),last:samples.at(-1),percent:qa.state.codex.buckets[0].windows[0].remainingPercent}
 },{patch,ms});
 for(const scene of ['potato','piranha','fox','luckycat','dinosaur','feidudu','buddy','beaver','hamster','cultivation','battery','aquarium','skadi']){
  await f.evaluate(()=>window.__evolutionQa.settings({evolutionMotion:'off',quotaSource:'eastmoney',reducedMotion:false}));
  await f.waitForFunction(()=>document.querySelector('.evolution-surface')?.dataset.phase==='idle');
  const selection=await sample({scene,evolutionMotion:'full'},950);
  const source=await sample({quotaSource:'codex'},2100);
  results.push({scene,selection,source});
 }
 const returning=await sample({quotaSource:'eastmoney'},750);
 const light=await sample({quotaSource:'codex',evolutionMotion:'light'},400);
 const off=await sample({quotaSource:'eastmoney',evolutionMotion:'off'},300);
 const reduced=await sample({quotaSource:'codex',evolutionMotion:'full',reducedMotion:true},400);
 for(const row of results){
  if(!row.selection.phases.includes('unfold')||!row.source.phases.includes('gather')||row.source.minOpacity>=1||!row.source.animations.includes('evolution-body-unfold')) throw new Error(`Missing body transition: ${JSON.stringify(row)}`);
  if(row.source.percent!==80)throw new Error('Visual effect changed quota');
 }
 for(const sample of [light,reduced])if(!sample.animations.includes('evolution-body-light')||sample.minOpacity>=1)throw new Error('Missing gentle fade');
 if(off.phases.some(p=>p!=='idle')||errors.length)throw new Error(JSON.stringify({off,errors}));
 return {results,returning,light,off,reduced,errors};
}
