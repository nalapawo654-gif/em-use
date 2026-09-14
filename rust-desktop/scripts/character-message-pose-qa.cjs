// Playwright CLI run-code. Real Vue actors; only accounts/windows use the fixture bridge.
async page => {
 const scenes=['feidudu','hamster','beaver','dinosaur','cultivation'], results=[], errors=[];
 page.on('pageerror',e=>errors.push(e.message)); await page.clock.install();
 const check=async(scene,label)=>{
  const r=await page.evaluate(scene=>{
   const e=document.querySelector('.message-launcher'),b=e.getBoundingClientRect(),w=document.querySelector(`.${scene}-widget`).getBoundingClientRect();
   const selectors='[class$="-speech"],[class$="-hud"],.beaver-sign,.hamster-quota,.cultivation-quota,[class$="-quota-wrap"],[class*="-header"] button,[class*="-tools"] button,[class*="-resize"]';
   const overlaps=[...document.querySelectorAll(selectors)].filter(el=>el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})).filter(el=>{const q=el.getBoundingClientRect();return Math.min(q.right,b.right)-Math.max(q.left,b.left)>1&&Math.min(q.bottom,b.bottom)-Math.max(q.top,b.top)>1}).map(el=>el.className);
   return {visible:e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),ready:e.querySelector('.character-mail-art')?.dataset.ready,hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('.message-launcher')===e,overlaps,x:b.x-w.x,y:b.y-w.y,width:b.width,count:document.querySelector('.message-count')?.textContent};
  },scene);
  if(!r.visible||!r.hit||r.ready!=='true'||r.overlaps.length||r.count!=='1')throw Error(JSON.stringify({scene,label,...r}));
  results.push({scene,label,...r});
 };
 const act=async(scene,action)=>{
  await page.evaluate(({scene,action})=>{const s=document.querySelector(`.${scene}-widget`).__vueParentComponent.setupState;if(action==='idle'){if(scene==='beaver')s.scene.cancel();else s.cancel()}else s.act(action)}, {scene,action});
  await page.clock.runFor(50);
  const current=await page.locator(`.${scene}-widget`).evaluate((e,scene)=>{const s=e.__vueParentComponent.setupState;return scene==='beaver'?document.querySelector('.beaver-scene').dataset.action:s.play.action},scene);
  if(current!==action)throw Error(`${scene}: requested ${action}, rendered ${current}`);
 };
 for(const scene of scenes){
  await page.setViewportSize({width:750,height:440});
  await page.goto(`http://127.0.0.1:5188/tests/fixtures/desktop.html?scene=${scene}&width=440&canvas=wide&messages=1&random=off&motion=off`,{waitUntil:'domcontentloaded'});
  await page.locator('.character-mail-art[data-ready=true]').waitFor();
  const config=await page.evaluate(async scene=>{
   const types=await import('/src/shared/types.ts'), play=await import(`/src/${scene}/play.ts`);
   const actions=scene==='beaver'?['groom','feed','drink','wood','pet','ball','leaves','bird','celebrate','rest']:scene==='hamster'?['feed','wheel','sleep','pet','groom','bell','tease','coffee','cat-yawn','cat-nap','cat-snack']:play[`${scene.toUpperCase()}_ACTIONS`].map(a=>a.id);
   if(scene==='cultivation')actions.push('greet');
   return {actions:['idle',...actions],skins:types[`${scene.toUpperCase()}_SKINS`].map(s=>s.id)};
  },scene);
  for(const gentle of [true,false])for(const percent of [100,70,50,20,15,0,null]){
   await page.evaluate(async({percent,gentle})=>{window.__setQuota(percent);await window.emUse.settings({reducedMotion:gentle})},{percent,gentle});
   for(const action of config.actions){
    await act(scene,action);await page.mouse.move(740,430);await check(scene,`${percent}/${action}/${gentle}/start`);
    await page.clock.fastForward(500);await page.clock.runFor(34);await check(scene,`${percent}/${action}/${gentle}/perform`);
    if(percent===15&&!gentle){await page.locator(`.${scene}-widget`).screenshot({path:`rust-desktop/docs/design/character-messages-v5/action-${scene}-${action}.png`});}
   }
  }
  await act(scene,'idle');
  for(const width of [440,300,190,180]){
   await page.setViewportSize({width:width+310,height:width});
   await page.evaluate(async width=>{document.documentElement.style.setProperty('--fixture-width',`${width}px`);await window.emUse.settings({windowWidth:width,reducedMotion:true})},width);
   for(const action of config.actions){await act(scene,action);await page.clock.runFor(180);await check(scene,`${width}/action/${action}`)}
   await act(scene,'idle');
   for(const form of (scene==='skadi'?['chibi','adult']:['default']))for(const skin of config.skins)for(const percent of [100,70,50,20,15,0,null]){
    await page.evaluate(async({scene,form,skin,percent})=>{const patch={[`${scene}Skin`]:skin};if(scene==='skadi'){patch.skadiForm=form;patch.skadiAdultSkin=skin}await window.emUse.settings(patch);window.__setQuota(percent)},{scene,form,skin,percent});
    await page.clock.runFor(50);await page.waitForFunction(()=>[...document.querySelectorAll('[data-loaded]')].every(e=>e.getAttribute('data-loaded')==='true'));if(scene==='skadi')await page.locator('.skadi-figure[data-ready=true]').waitFor();await page.locator('.message-launcher').hover();await page.clock.runFor(34);await check(scene,`${width}/${form}/${skin}/${percent}`);
    if(width===440&&percent===15){await page.mouse.move(740,430);await page.locator(`.${scene}-widget`).screenshot({path:`rust-desktop/docs/design/character-messages-v5/action-${scene}-${form}-${skin}.png`});}
   }
  }
 }
 if(errors.length)throw Error(JSON.stringify(errors));return {samples:results.length,scenes,errors};
}
