// Browser UI integration against the mocked native bridge, not an OS/account test.
async page=>{
 const checks=[];const check=(ok,name)=>{if(!ok)throw Error(name);checks.push(name)};
 await page.goto('http://127.0.0.1:5186/tests/fixtures/skadi-native.html');await page.setViewportSize({width:440,height:440});
 const visual=page.locator('.skadi-character .skadi-visual'),weapon=page.locator('.skadi-character .skadi-visual');
 const loaded=async()=>{await visual.locator('.skadi-motion').waitFor();await weapon.locator('canvas[data-ready=true]').waitFor()};await loaded();
 await page.evaluate(()=>{window.skadiQA.state.settings.reducedMotion=true;window.skadiQA.publish()});
 await page.mouse.move(-10,-10);check(await weapon.locator('canvas[data-ready=true]').isVisible(),'equipped weapon visible without hover');
 const panel=async name=>{await page.locator('.skadi-widget').hover();await page.getByRole('button',{name,exact:true}).click()};
 for(const form of ['adult','chibi']){
  await panel('月汐换装');await page.locator('.skadi-panel .skadi-form-picker button').filter({hasText:form==='adult'?'御姐':'萝莉'}).click();
  check(await visual.getAttribute('data-form')===form,form+' switches actual renderer');
  for(const [id,label] of [['classic','夜海之誓'],['moonlight','纯白圣歌'],['gothic','暗夜魅影'],['sakura','樱落和服'],['azure','星穹战姬'],['pajamas','休闲居家']]){
   await page.locator('.skadi-panel .skadi-skins button').filter({hasText:label}).click();await loaded();
   check(await visual.getAttribute('data-skin')===id,form+' '+id+' actual art loads');
   check(await weapon.getAttribute('data-weapon')==='sword',form+' '+id+' keeps equipment');
  }
  await page.keyboard.press('Escape');
 }
 await panel('月汐换装');await page.locator('.skadi-panel .skadi-skins button').filter({hasText:'樱落和服'}).click();await page.locator('.skadi-panel .skadi-form-picker button').filter({hasText:'御姐'}).click();await loaded();
 check(await visual.getAttribute('data-skin')==='pajamas','adult remembers its own wardrobe');await page.locator('.skadi-panel .skadi-form-picker button').filter({hasText:'萝莉'}).click();await loaded();check(await visual.getAttribute('data-skin')==='sakura','chibi remembers its own wardrobe');await page.keyboard.press('Escape');
 for(const [id,label] of [['sword','赤渊长剑'],['scythe','月蚀镰刀'],['staff','星眠法杖'],['twins','冰霜双刃'],['bow','血月弓'],['butterfly','灵蝶浮刃']]){
  await panel('月汐武器库');await page.locator('.skadi-panel .skadi-armory button').filter({hasText:label}).click();await page.keyboard.press('Escape');
  check(await weapon.getAttribute('data-weapon')===id,id+' selected weapon persists');check(await weapon.locator('canvas[data-ready=true]').isVisible(),id+' visible at rest');
  await panel('月汐更多玩法');await page.locator('.skadi-panel .skadi-play-grid button').filter({hasText:'释放武器技能'}).click();await loaded();
  check(await weapon.getAttribute('data-power')==='attack',id+' enters skill');check(await page.locator('.skadi-character .effect-'+id+' .skadi-skill-field').isVisible(),id+' has own skill field');
  await page.keyboard.press('Escape');check(await weapon.getAttribute('data-power')==='rest',id+' exits to equipped idle');
 }
 const actions=[['轻轻摸头','pet'],['听她哼唱','sing'],['释放武器技能','blade'],['逗逗夜影','cat'],['陪你工作','work'],['晚安月汐','sleep'],['走一走','walk'],['安静坐下','sit'],['挥挥手','wave'],['一起喝茶','drink'],['召唤魔法','summon'],['海边钓鱼','fish'],['喂一口点心','feed'],['随月起舞','dance'],['乘风飞行','fly'],['回眸看看','turn']];
 for(const [label,id] of actions){await panel('月汐更多玩法');await page.locator('.skadi-panel .skadi-play-grid button').filter({hasText:label}).click();await loaded();check(await visual.getAttribute('data-motion')===id,id+' action runs');check(await page.evaluate(()=>window.skadiQA.state.quota.percent)===100,id+' preserves account quota');
  if(['drink','feed','work'].includes(id)){await visual.locator('.skadi-prop').waitFor();check(await visual.locator('.skadi-prop').evaluate(img=>img.complete&&img.naturalWidth>0),id+' real prop loaded')}
  await page.keyboard.press('Escape');check(await page.locator('.skadi-hud').count()===0,id+' Escape exits');
 }
 await panel('月汐更多玩法');await page.locator('.skadi-play-grid button').filter({hasText:'海边钓鱼'}).click();await page.getByRole('button',{name:'提竿',exact:true}).click();check((await page.locator('.skadi-speech').innerText()).includes('再等等'),'early reel does not claim a catch');await page.waitForTimeout(2450);await page.getByRole('button',{name:'提竿',exact:true}).click();await visual.locator('.skadi-caught-fish').waitFor();check((await page.locator('.skadi-speech').innerText()).includes('钓到'),'reel after bite catches fish');await page.waitForTimeout(2300);check(await page.locator('.skadi-hud').count()===0,'catch finishes automatically');
 for(const width of [440,300,190,180]){
  await page.setViewportSize({width,height:width});await page.evaluate(w=>window.skadiQA.setSize(w),width);
  for(const kind of ['月汐换装','月汐武器库','月汐更多玩法']){
   await panel(kind);const dialog=page.getByRole('dialog');const last=dialog.locator(kind==='月汐换装'?'.skadi-skins button':kind==='月汐武器库'?'.skadi-armory button':'.skadi-play-grid button').last();await last.scrollIntoViewIfNeeded();
   const box=await last.boundingBox();check(box&&box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=width,kind+' last item accessible '+width);
   const close=page.getByRole('button',{name:'关闭月汐面板',exact:true});check(await close.isVisible(),kind+' close remains available '+width);
   await page.screenshot({path:'output/playwright/skadi-v2-panel-'+width+'-'+(kind==='月汐换装'?'wardrobe':kind==='月汐武器库'?'armory':'play')+'.png'});await close.click();
  }
  for(const form of ['adult','chibi']){await page.evaluate(f=>{window.skadiQA.state.settings.skadiForm=f;window.skadiQA.publish()},form);await loaded();check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),form+' fits '+width);check(await weapon.locator('canvas[data-ready=true]').isVisible(),form+' idle weapon fits '+width)}
  await panel('月汐更多玩法');await page.locator('.skadi-play-grid button').filter({hasText:'海边钓鱼'}).click();const b=await page.getByRole('button',{name:'提竿',exact:true}).boundingBox();check(b&&b.x>=0&&b.x+b.width<=width&&b.y+b.height<=width,'reel button fits '+width);await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:440,height:440});await page.evaluate(()=>{window.skadiQA.setSize(440);window.skadiQA.state.settings.reducedMotion=false;window.skadiQA.publish()});await loaded();
 check(await visual.locator('canvas').count()===1,'actual animated mesh used');await page.emulateMedia({reducedMotion:'reduce'});check(await visual.locator('.skadi-motion').evaluate(el=>getComputedStyle(el).animationName==='none'),'system motion preference respected');await page.emulateMedia({reducedMotion:'no-preference'});
 return {checks:checks.length,results:checks};
}
