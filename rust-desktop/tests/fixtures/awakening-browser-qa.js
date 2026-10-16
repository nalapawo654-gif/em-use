// Pass this function to playwright-cli run-code while evolution-harness.html is open.
async (page) => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const scenes=['potato','piranha','fox','luckycat','dinosaur','feidudu','buddy','beaver','hamster','cultivation','battery','aquarium','skadi'];
 const f=page.frames()[1],results=[];
 await page.mouse.move(1100,650);
 const settle=async scene=>{
  await f.waitForFunction(scene=>{
   const selector=scene==='buddy'?'.buddy-rig':scene==='cultivation'?'.cultivator-motion':scene==='aquarium'?'.aquarium':`.${scene}-visual`;
   const root=document.querySelector(selector),actor=root?.matches('[data-awakened="true"]')?root:root?.querySelector('[data-awakened="true"]');
   if(!actor||!Array.from(root.querySelectorAll('img')).every(i=>i.complete&&i.naturalWidth>0))return false;
   const canvas=actor.tagName==='CANVAS'?actor:actor.querySelector('canvas');
   if(canvas&&!canvas.matches('.cultivator-motion canvas')){const ctx=canvas.getContext('2d');if(ctx){const d=ctx.getImageData(0,0,canvas.width,canvas.height).data;return d.some((v,i)=>i%4===3&&v>0)}}
   return true
  },scene,{timeout:15000});
 };
 for(const scene of scenes){
  await f.evaluate(scene=>{window.__evolutionQa.settings({scene,reducedMotion:true,evolutionMotion:'off',quotaSource:'codex'});window.__evolutionQa.quota(80)},scene);
  await settle(scene);
  for(const size of [190,300,440]){
   await page.locator('#pet').evaluate((e,size)=>{e.style.width=size+'px';e.style.height=size+'px'},size);
   // ResizeObserver resets canvas backing stores; allow the reduced-motion draw.
   await f.evaluate(()=>new Promise(resolve=>{const start=performance.now();const tick=now=>now-start>=240?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick)}));
   await settle(scene);
   await page.locator('#pet').screenshot({path:`output/playwright/v2-${scene}-${size}.png`});
   const layout=await f.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,errors:Array.from(document.querySelectorAll('[role="alert"]')).map(e=>e.textContent)}));
   results.push({scene,size,...layout});
  }
  await f.evaluate(()=>window.__evolutionQa.quota(0));
  await f.waitForFunction(()=>Array.from(document.querySelectorAll('[data-awakening-energy]')).every(e=>e.getAttribute('data-awakening-energy')==='0.00'));
  // Reduced-motion canvas scenes paint every 160–200 ms; wait for that render interval.
  await f.evaluate(()=>new Promise(resolve=>{const start=performance.now();const tick=now=>now-start>=240?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick)}));
  await page.locator('#pet').screenshot({path:`output/playwright/v2-${scene}-empty-440.png`});
  await f.evaluate(()=>window.__evolutionQa.settings({quotaSource:'eastmoney'}));
  await f.waitForFunction(()=>!document.querySelector('[data-awakened="true"]'));
  await f.evaluate(()=>{window.__evolutionQa.settings({quotaSource:'codex'});window.__evolutionQa.quota(80)});
  await settle(scene);
 }
 return {results,errors};
}
