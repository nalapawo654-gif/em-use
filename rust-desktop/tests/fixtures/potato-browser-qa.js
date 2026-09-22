async page => {
 const passed=[]; const check=(ok,name)=>{if(!ok)throw Error(name);passed.push(name)};
 const base='http://127.0.0.1:5189/tests/fixtures/desktop.html?scene=potato&canvas=1&calendar=1&messages=1&motion=off';
 const visit=async(width=440,extra='')=>{await page.setViewportSize({width:900,height:650});await page.goto(base+'&width='+width+extra);await page.locator('.potato-character>.potato-motion>.potato-sprite[data-ready=true]').waitFor();await page.mouse.move(880,610);await page.waitForTimeout(230)};
 const main='.potato-character>.potato-motion>.potato-sprite';
 const shown=selector=>page.locator(selector).evaluate(el=>{const s=getComputedStyle(el);return s.opacity!=='0'&&s.visibility==='visible'&&s.pointerEvents!=='none'});
 const action=async label=>{await page.locator('.potato-widget').hover();await page.getByRole('button',{name:'土豆战神更多玩法',exact:true}).click();await page.locator('.potato-play-grid button').filter({hasText:label}).click()};
 await visit();
 check(!await shown('.potato-header'),'chrome initially hidden');
 await page.locator('.potato-widget').hover();check(await shown('.potato-header'),'hover reveals chrome');
 await page.getByRole('button',{name:'土豆战神换装',exact:true}).click();await page.mouse.move(880,610);
 check(await page.getByRole('dialog').isVisible(),'wardrobe persists after mouse leave');
 check(await page.locator('.potato-panel .potato-skins button').count()===20,'all twenty outfits in native wardrobe');
 check(!await shown('.potato-resize.nw'),'panel blocks resize');
 const skins=await page.evaluate(async()=> (await import('/src/potato/catalog.ts')).POTATO_SKINS);
 for(const skin of skins){
  await page.locator('.potato-panel .potato-skins button[data-skin="'+skin.id+'"]').click();
  check(await page.evaluate(async()=>JSON.stringify((await window.emUse.getState()).settings.piranhaSkin))==='"classic"',skin.id+': other pet settings retained');
 }
 await page.keyboard.press('Escape');
 const hashes=new Set();
 for(const skin of skins){
  await page.evaluate(skin=>window.emUse.settings({potatoSkin:skin}),skin.id);
  for(const [i,p] of [100,75,50,25].entries()){
   await page.evaluate(p=>window.__setQuota(p),p);
   await page.locator(main+'[data-atlas="'+skin.atlas+'"][data-frame="'+(skin.row*4+i)+'"][data-ready=true]').waitFor();
   const info=await page.locator(main+' canvas').evaluate(c=>{const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let ink=0,clear=0,hash=2166136261;for(let i=0;i<data.length;i++){hash=Math.imul(hash^data[i],16777619);if(i%4===3){if(data[i]>200)ink++;if(data[i]===0)clear++}}return{hash:hash>>>0,ink,clear}});
   check(info.ink>3000&&info.clear>3000,skin.id+': '+p+'% visible art with transparent background');
   hashes.add(info.hash);
  }
 }
 check(hashes.size===80,'all eighty armor frames are visually distinct');
 for(const p of [0,null]){await page.evaluate(p=>window.__setQuota(p),p);await page.locator(main+'[data-frame="'+(p===null?12:15)+'"]').waitFor();check(true,'last skin preserved at '+p)}
 await page.evaluate(()=>{window.__setQuota(50);return window.emUse.settings({potatoSkin:'pink'})});
 const quota=await page.evaluate(async()=>JSON.stringify((await window.emUse.getState()).quota));
 for(const [id,label,duration] of [['pet','摸摸头盔',1800],['coffee','喂口咖啡',3400],['cheer','插上加油旗',3600],['tease','逗逗战神',2600]]){
  await action(label);check(await page.locator('.potato-character').getAttribute('data-action')===id,id+': correct action');
  check(await page.locator('.potato-character').getAttribute('data-skin')==='pink',id+': selected skin remains');
  check(await page.locator('.message-launcher').isVisible(),id+': message beacon stays available');
  await page.waitForTimeout(duration+160);check(await page.locator('.potato-character').getAttribute('data-action')==='idle',id+': finishes');
 }
 for(const label of ['打开驾驶舱','拧紧螺丝']){
  await action(label);await page.waitForTimeout(900);check((await page.locator('.potato-progress').innerText()).includes('0/3'),label+': waiting does not finish');
  for(let i=0;i<3;i++){await page.locator('.potato-progress').click();await page.waitForTimeout(260)}
  check((await page.locator('.potato-progress').innerText()).includes('完成'),label+': three taps complete');
  await page.waitForTimeout(1150);check(await page.locator('.potato-character').getAttribute('data-action')==='idle',label+': returns to latest quota');
 }
 await action('装备锅盖');await page.waitForTimeout(1200);check(await page.locator('.potato-character').getAttribute('data-action')==='shield','shield persists');
 await page.getByRole('button',{name:'卸下',exact:true}).click();check(await page.locator('.potato-character').getAttribute('data-action')==='idle','shield explicitly removed');
 check(await page.evaluate(async()=>JSON.stringify((await window.emUse.getState()).quota))===quota,'interactions preserve real quota');
 await page.locator('.potato-body-hit').click();check(await page.locator('.potato-character').getAttribute('data-action')==='pet','body tap responds');await page.keyboard.press('Escape');
 await page.mouse.move(220,190);await page.mouse.down();await page.mouse.move(255,225,{steps:5});await page.mouse.up();await page.waitForTimeout(100);
 check(await page.locator('.potato-character').getAttribute('data-action')==='idle','drag suppresses following body click');
 for(const width of [440,300,190,180]){
  await visit(width,'&percent=25');
  for(const selector of ['.potato-character','.potato-quota','.pet-calendar','.message-launcher']){const b=await page.locator(selector).boundingBox();check(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=width+1,selector+' fits '+width)}
  await page.locator('.potato-widget').hover();await page.getByRole('button',{name:'土豆战神换装',exact:true}).click();
  await page.getByRole('button',{name:'装备驯鹿圣诞',exact:true}).click();await page.getByRole('button',{name:'关闭土豆战神面板',exact:true}).click();
  check(await page.locator('.potato-character').getAttribute('data-skin')==='santa','last wardrobe item reachable at '+width);
  await action('打开驾驶舱');const b=await page.locator('.potato-progress').boundingBox();check(b&&b.y+b.height<width,'interactive button reachable '+width);await page.keyboard.press('Escape');
  await page.mouse.move(880,610);await page.waitForTimeout(240);await page.locator('.potato-widget').screenshot({path:'output/playwright/potato-size-'+width+'.png'});
 }
 await visit(190,'&theme=night&percent=25');await page.locator('.potato-widget').screenshot({path:'output/playwright/potato-night-mini.png'});
 check(await page.locator('.potato-motion').evaluate(el=>getComputedStyle(el).animationName==='none'),'gentle stops repeated animation');
 for(const status of ['stale','expired','resetting','unavailable','forbidden','signed-out','connecting']){
  await visit(300,'&status='+status);const text=await page.locator('.potato-quota').innerText();check(status==='stale'?text.includes('数据待更新'):text.includes('—'),status+': quota status remains truthful');
 }
 await visit();await page.getByRole('button',{name:/今日日程，机甲日程终端/}).click();check((await page.locator('.potato-widget').getAttribute('class')).includes('calendar-is-open'),'calendar shared window opens');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('calendar-panel-closed')));await page.locator('.message-launcher').click();check(await page.evaluate(()=>document.body.dataset.messagePanelRequested==='true'),'message shared card opens');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('message-panel-closed')));
 await page.evaluate(async()=>{const s=await window.emUse.getState();await window.emUse.clearMessages(s.messages.epoch,s.messages.items.map(i=>i.key))});check(!await page.locator('.message-launcher').isVisible(),'read reminders remove beacon');
 return {passed:passed.length,checks:passed};
}
