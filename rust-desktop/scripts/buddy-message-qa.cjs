// Run with Playwright CLI run-code. Uses the real Vue scene and its public act API.
async page => {
 const skins=['classic','worker','holiday','midnight','blossom'];
 const durations={idle:0,feed:5800,drink:6200,pet:4200,clean:0,play:5600,swat:5100,wag:4000,sleep:7600,shake:3200,rest:5400,inflate:4800,celebrate:3200};
 const errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await page.setViewportSize({width:750,height:440});
 await page.goto('http://127.0.0.1:5188/tests/fixtures/desktop.html?scene=buddy&width=440&messages=1&motion=off',{waitUntil:'domcontentloaded'});
 await page.locator('.buddy-mail-art[data-ready=true]').waitFor();
 const act=async action=>{await page.evaluate(a=>document.querySelector('.buddy-scene').__vueParentComponent.exposed.act(a),action);await page.clock.runFor(120)};
 const check=async(label)=>{
  const r=await page.evaluate(()=>{
   const e=document.querySelector('.message-launcher'),b=e.getBoundingClientRect(),art=e.querySelector('canvas');
   const overlaps=[...document.querySelectorAll('.buddy-sign,.buddy-speech,.buddy-tools button,.buddy-header button,.buddy-hud,.buddy-stand,.buddy-motto')].filter(el=>el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})).filter(el=>{const q=el.getBoundingClientRect();return Math.min(q.right,b.right)-Math.max(q.left,b.left)>1&&Math.min(q.bottom,b.bottom)-Math.max(q.top,b.top)>1}).map(el=>el.className||el.ariaLabel);
   return {visible:e.checkVisibility({checkVisibilityCSS:true}),x:b.x,y:b.y,w:b.width,h:b.height,overlaps,ready:art.dataset.ready,action:document.querySelector('.buddy-scene').dataset.action,phase:document.querySelector('.buddy-rig canvas').dataset.phase,count:document.querySelector('.message-count')?.textContent};
  });
  if(!r.visible||r.ready!=='true'||r.count!=='1'||r.overlaps.length||r.x<0||r.y<0||r.x+r.w>441||r.y+r.h>441)throw Error(JSON.stringify({label,...r}));
  results.push({label,...r});return r;
 };
 for(const reducedMotion of [false,true])for(const skin of skins){
  await page.evaluate(async settings=>window.emUse.settings(settings),{buddySkin:skin,reducedMotion});
  // Ensure the real replacement rig is decoded before sampling its animation.
  await page.evaluate(async skin=>{const {buddyRig}=await import('/src/buddy/sprites.ts');await buddyRig(skin)},skin);
  for(const percent of [100,50,20,15]){
   await page.evaluate(p=>window.__setQuota(p),percent);
   for(const [action,duration] of Object.entries(durations)){
    await act(action);const label=`${skin}/${percent}/${action}/${reducedMotion?'static':'animated'}`;
    await check(label+'/prepare');
    const end=reducedMotion?Math.min(duration,1800):duration;
    await page.clock.fastForward(end?Math.max(100,Math.floor(end*.52)-120):950);await page.clock.runFor(100);
    await check(label+'/perform');
    if(!reducedMotion&&((skin==='classic')||(percent===15&&['idle','swat','sleep','inflate'].includes(action)))){
     await page.mouse.move(700,420);await page.screenshot({path:`rust-desktop/output/playwright/buddy-${skin}-${percent}-${action}.png`});
    }
    if(end){await page.clock.fastForward(Math.max(100,end*.48-500));await page.clock.runFor(100);await check(label+'/recover');await page.clock.fastForward(650);await page.clock.runFor(100);if(await page.locator('.buddy-scene').getAttribute('data-action')!=='idle')throw Error(label+' did not return idle');await check(label+'/idle');}
   }
  }
 }
 if(errors.length)throw Error(JSON.stringify(errors));
 return {scenarios:520,samples:results.length,errors,positionRange:{x:[Math.min(...results.map(r=>r.x)),Math.max(...results.map(r=>r.x))],y:[Math.min(...results.map(r=>r.y)),Math.max(...results.map(r=>r.y))]},phases:[...new Set(results.map(r=>r.phase))]};
}
