async page => {
 const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();
 for(const width of [440,300,190,180]){
  await page.setViewportSize({width:width+310,height:width});
  await page.goto(`http://127.0.0.1:5188/tests/fixtures/desktop.html?scene=buddy&width=${width}&messages=1&motion=off`,{waitUntil:'domcontentloaded'});
  await page.locator('.buddy-mail-art[data-ready=true]').waitFor();
  for(const skin of ['classic','worker','holiday','midnight','blossom'])for(const theme of ['day','night'])for(const percent of [100,50,20,15]){
   await page.evaluate(async({skin,theme,percent})=>{await window.emUse.settings({buddySkin:skin,theme});window.__setQuota(percent);const {buddyRig}=await import('/src/buddy/sprites.ts');await buddyRig(skin);document.querySelector('.buddy-scene').__vueParentComponent.exposed.cancel()},{skin,theme,percent});
   await page.clock.runFor(250);await page.locator('.message-launcher').hover();
   const r=await page.evaluate(()=>{
    const e=document.querySelector('.message-launcher'),b=e.getBoundingClientRect();
    const overlaps=[...document.querySelectorAll('.buddy-sign,.buddy-speech,.buddy-tools button,.buddy-header button,.buddy-motto,[class*=buddy-resize]')].filter(el=>el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})).filter(el=>{const q=el.getBoundingClientRect();return Math.min(q.right,b.right)-Math.max(q.left,b.left)>1&&Math.min(q.bottom,b.bottom)-Math.max(q.top,b.top)>1}).map(el=>el.className||el.ariaLabel);
    return {visible:e.checkVisibility({checkVisibilityCSS:true}),x:b.x,y:b.y,right:b.right,bottom:b.bottom,overlaps,hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('.message-launcher')===e};
   });
   if(!r.visible||!r.hit||r.overlaps.length||r.right>width||r.bottom>width)throw Error(JSON.stringify({width,skin,percent,theme,...r}));
   if(skin==='classic'&&[100,15].includes(percent)){
    await page.screenshot({path:`rust-desktop/output/playwright/buddy-layout-${width}-${theme}-${percent}-controls.png`});
    await page.mouse.move(width+300,width-10);await page.clock.runFor(300);await page.screenshot({path:`rust-desktop/output/playwright/buddy-layout-${width}-${theme}-${percent}.png`});
   }
   results.push({width,skin,percent,theme,...r});
  }
 }
 if(errors.length)throw Error(JSON.stringify(errors));return{count:results.length,errors,clear:results.every(r=>!r.overlaps.length&&r.hit)};
}
