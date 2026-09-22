async (page) => {
  const passed = [];
  const check = (ok, name) => { if (!ok) throw new Error(name); passed.push(name); };
  const base = 'http://127.0.0.1:5189/tests/fixtures/desktop.html?scene=piranha&calendar=1&messages=1&motion=off&canvas=1';
  const visit = async (width=440, extra='') => {
    await page.setViewportSize({width:Math.max(width+320,800),height:Math.max(width,600)});
    await page.goto(base + '&width='+width+extra);
    await page.locator('.piranha-character .piranha-sprite[data-ready=true]').waitFor();
    await page.mouse.move(760,560); await page.waitForTimeout(250);
  };
  const shown = selector => page.locator(selector).evaluate(el => {const s=getComputedStyle(el);return s.opacity!=='0'&&s.visibility==='visible'&&s.pointerEvents!=='none'});
  await visit();
  check(!await shown('.piranha-header'),'initial chrome hidden');
  await page.locator('.piranha-widget').hover();
  check(await shown('.piranha-header'),'hover shows chrome');
  await page.getByRole('button',{name:'食人花换装',exact:true}).click();
  await page.mouse.move(760,560);
  check(await page.getByRole('dialog').isVisible(),'panel survives mouse leave');
  check(!await shown('.piranha-resize.nw'),'panel suppresses resize');
  await page.getByRole('button',{name:'关闭食人花面板',exact:true}).click();
  await page.mouse.move(760,560); await page.waitForTimeout(250);
  check(!await shown('.piranha-header'),'mouse click focus does not retain chrome');
  await page.keyboard.press('Tab');
  // Explicit keyboard focus is tested on the body, independent of preceding prop tab order.
  await page.locator('.piranha-body-hit').focus();
  check(await shown('.piranha-header'),'keyboard focus shows chrome');
  const initial = await page.evaluate(async()=>JSON.stringify((await window.emUse.getState()).quota));
  for (const [id,label,duration] of [['feed','投喂需求',3200],['bloom','夸夸开花',2400],['tease','逗逗花',2600],['pet','摸摸花冠',1800],['sleep','合苞小憩',null]]) {
    await page.locator('.piranha-widget').hover();
    await page.getByRole('button',{name:'食人花更多玩法',exact:true}).click();
    await page.locator('.piranha-play-grid button').filter({hasText:label}).click();
    check(await page.locator('.piranha-character').getAttribute('data-action')===id,id+' enters own action');
    check(await page.locator('.message-launcher').isVisible(),id+' keeps message prop');
    check(!await page.locator('.pet-calendar').isVisible(),id+' defers calendar');
    if(duration){await page.waitForTimeout(duration+150);check(await page.locator('.piranha-hud').count()===0,id+' automatically completes');}
    else{await page.waitForTimeout(500);check(await page.getByRole('button',{name:'起床',exact:true}).isVisible(),'sleep has exit');await page.keyboard.press('Escape');}
    check(await page.evaluate(async()=>JSON.stringify((await window.emUse.getState()).quota))===initial,id+' preserves quota');
  }
  await page.locator('.piranha-body-hit').click();
  check(await page.locator('.piranha-character').getAttribute('data-action')==='pet','body click pets flower');
  await page.keyboard.press('Escape');
  const body=await page.locator('.piranha-body-hit').boundingBox();
  await page.mouse.move(body.x+body.width/2,body.y+body.height/2);await page.mouse.down();await page.mouse.move(body.x+body.width/2+30,body.y+body.height/2+25,{steps:4});await page.mouse.up();
  check(await page.evaluate(()=>document.body.dataset.gestureMoved==='true'),'drag calls shared bridge');
  check(await page.locator('.piranha-hud').count()===0,'drag suppresses pet click');
  for(const [percent,frame] of [[100,0],[75,1],[50,2],[25,3],[0,3]]){
    await visit(440,'&percent='+percent);
    check(await page.locator('.piranha-character .piranha-sprite').getAttribute('data-frame')===String(frame),'quota '+percent+' selects authored posture');
  }
  for(const status of ['expired','resetting','unavailable','forbidden','connecting','signed-out','stale']){
    await visit(440,'&percent=10&status='+status);
    const text=await page.locator('.piranha-quota').innerText();
    check(status==='stale'?text.includes('10')&&text.includes('数据待更新'):text.includes('—'),'status '+status+' semantics');
  }
  for(const width of [440,300,190,180]){
    await visit(width);
    const box=await page.locator('.piranha-widget').boundingBox();check(box.width===width&&box.height===width,'square widget '+width);
    for(const selector of ['.piranha-quota','.pet-calendar','.message-launcher']){
      const b=await page.locator(selector).boundingBox();check(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=width+1,selector+' fits '+width);
    }
    for(const skin of ['经典款','樱花款','仙人掌款','万圣节款','圣诞款']){
      await page.locator('.piranha-widget').hover();await page.getByRole('button',{name:'食人花换装',exact:true}).click();
      await page.getByRole('button',{name:skin,exact:true}).click();
      await page.getByRole('button',{name:'关闭食人花面板',exact:true}).click();
      await page.locator('.piranha-character .piranha-sprite[data-ready=true]').waitFor();
      check(await page.locator('.message-launcher').isVisible(),skin+' mail remains '+width);
    }
    await page.locator('.piranha-widget').hover();await page.getByRole('button',{name:'食人花更多玩法',exact:true}).click();
    await page.locator('.piranha-play-grid button').filter({hasText:'合苞小憩'}).click();
    const b=await page.getByRole('button',{name:'起床',exact:true}).boundingBox();check(b&&b.y+b.height<width,'sleep exit fits '+width);await page.keyboard.press('Escape');
    await page.mouse.move(760,560);await page.waitForTimeout(250);
    await page.locator('.piranha-widget').screenshot({path:'output/playwright/piranha-size-'+width+'.png'});
  }
  await visit(190,'&theme=night&percent=10');
  await page.locator('.piranha-widget').screenshot({path:'output/playwright/piranha-night-mini.png'});
  check(await page.locator('.piranha-motion').evaluate(el=>getComputedStyle(el).animationName==='none'),'gentle disables continuous motion');
  await visit();
  await page.getByRole('button',{name:/今日日程，叶片翻页历/}).click();
  check(await page.locator('.piranha-widget').getAttribute('class').then(s=>s.includes('calendar-is-open')),'calendar opens shared panel');
  check(!await page.locator('.message-launcher').isVisible(),'calendar blocks message entry');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('calendar-panel-closed')));
  await page.locator('.message-launcher').click();
  check(await page.evaluate(()=>document.body.dataset.messagePanelRequested==='true'),'message opens shared card');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('message-panel-closed')));
  await page.evaluate(async()=>{const s=await window.emUse.getState();await window.emUse.clearMessages(s.messages.epoch,s.messages.items.map(i=>i.key));});
  check(!await page.locator('.message-launcher').isVisible(),'cleared reminders remove prop');
  await page.evaluate(results=>{document.body.dataset.piranhaQa=JSON.stringify(results)},passed);
  return passed;
}
