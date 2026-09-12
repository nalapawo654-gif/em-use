// Run with Playwright CLI run-code against skadi-native.html. OS bridge is simulated.
async page => {
  await page.goto('http://127.0.0.1:5186/tests/fixtures/skadi-native.html');await page.setViewportSize({width:440,height:440});
  const results=[];const check=(ok,name)=>{if(!ok)throw Error(name);results.push(name)};
  await page.locator('.skadi-character .skadi-visual[data-loaded=true]').waitFor();
  await page.evaluate(()=>{window.skadiQA.state.settings.reducedMotion=true;window.skadiQA.publish()});
  const visibleChrome=()=>page.locator('.skadi-header').evaluate(el=>({opacity:getComputedStyle(el).opacity,visibility:getComputedStyle(el).visibility,pointer:getComputedStyle(el).pointerEvents}));
  await page.mouse.move(439,439);await page.mouse.move(-10,-10);await page.waitForTimeout(300);
  check((await visibleChrome()).visibility==='hidden','idle controls hidden');
  await page.getByRole('button',{name:'轻轻摸摸月汐的头',exact:true}).hover();
  check((await visibleChrome()).visibility==='visible','hover reveals controls');
  await page.getByRole('button',{name:'月汐更多玩法',exact:true}).click();await page.mouse.move(-10,-10);
  check(await page.getByRole('dialog').isVisible(),'panel persists outside hover');
  check(await page.locator('.skadi-resize').first().evaluate(el=>getComputedStyle(el).visibility==='hidden'),'panel suppresses resize');
  await page.getByRole('button',{name:'月汐换装',exact:true}).click();check(await page.getByRole('dialog').count()===1,'panels mutually exclusive');
  await page.keyboard.press('Escape');check(await page.getByRole('dialog').count()===0,'Escape closes panel');
  await page.mouse.move(-10,-10);check((await visibleChrome()).visibility==='hidden','mouse click leaves no sticky focus');
  await page.keyboard.press('Tab');check((await visibleChrome()).visibility==='visible','keyboard focus reveals controls');
  await page.keyboard.press('Escape');
  for(const [label,frame,duration] of [['轻轻摸头',1,3000],['听她哼唱',2,6000],['释放武器技能',3,4600],['逗逗夜影',1,3800],['陪你工作',5,0],['晚安月汐',4,0]]){
    await page.locator('.skadi-widget').hover();await page.getByRole('button',{name:'月汐更多玩法',exact:true}).click();
    await page.getByRole('dialog').getByRole('button').filter({hasText:label}).click();
    await page.locator('.skadi-character .skadi-visual[data-loaded=true]').waitFor();
    check(await page.locator('.skadi-character .skadi-visual').getAttribute('data-frame')===String(frame),label+' authored pose');
    check(await page.evaluate(()=>window.skadiQA.state.quota.percent)===100,label+' preserves quota');
    if(duration){await page.waitForTimeout(duration+120);check(await page.locator('.skadi-hud').count()===0,label+' completes')}
    else{check(await page.locator('.skadi-hud button').isVisible(),label+' explicit exit');await page.keyboard.press('Escape')}
  }
  await page.evaluate(()=>{window.skadiQA.calls.length=0});
  const box=await page.getByRole('button',{name:'轻轻摸摸月汐的头',exact:true}).boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+20,{steps:4});await page.mouse.up();
  check(await page.locator('.skadi-hud').count()===0,'drag suppresses pet click');
  check(await page.evaluate(()=>window.skadiQA.calls.some(c=>c[0]==='move')),'drag calls shared bridge');
  await page.waitForTimeout(430);
  for(const [p,f] of [[100,0],[50,0],[10,5],[0,5]]){await page.evaluate(p=>window.skadiQA.setPercent(p),p);await page.waitForTimeout(60);check(await page.locator('.skadi-character .skadi-visual').getAttribute('data-frame')===String(f),'quota '+p+' pose');}
  for(const status of ['stale','expired','resetting','forbidden','unavailable','connecting','signed-out']){await page.evaluate(s=>window.skadiQA.setStatus(s),status);await page.waitForTimeout(60);const text=await page.locator('.skadi-quota').innerText();check(status==='stale'?text.includes('0'):text.includes('—'),'status '+status+' semantics');}
  await page.evaluate(()=>window.skadiQA.setPercent(100));
  for(const width of [440,300,190,180]){
    await page.setViewportSize({width,height:width});await page.evaluate(w=>window.skadiQA.setSize(w),width);await page.locator('.skadi-widget').hover();
    await page.getByRole('button',{name:'月汐更多玩法',exact:true}).click();await page.getByRole('dialog').getByRole('button').filter({hasText:'晚安月汐'}).click();
    const end=page.locator('.skadi-hud button'),b=await end.boundingBox();check(b&&b.y>=0&&b.y+b.height<=width,'sleep exit fits '+width);await end.click();
    await page.getByRole('button',{name:'月汐换装',exact:true}).click();await page.getByRole('dialog').getByRole('button').filter({hasText:'休闲居家'}).click();
    check(await page.evaluate(()=>window.skadiQA.state.settings.skadiSkin)==='pajamas','skin saves '+width);
    await page.screenshot({path:'output/playwright/skadi-panel-'+width+'.png'});await page.getByRole('button',{name:'关闭月汐面板',exact:true}).click();
    for(const skin of ['classic','moonlight','pajamas'])for(const theme of ['day','night']){
      await page.evaluate(({skin,theme})=>{window.skadiQA.state.settings.skadiSkin=skin;window.skadiQA.state.settings.theme=theme;window.skadiQA.publish()},{skin,theme});
      await page.locator('.skadi-character .skadi-visual[data-loaded=true]').waitFor();await page.mouse.move(-10,-10);
      check(await page.locator('.skadi-quota').isVisible(),skin+' '+theme+' quota visible '+width);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),skin+' '+theme+' viewport fits '+width);
    }
    await page.screenshot({path:'output/playwright/skadi-native-'+width+'.png'});
  }
  await page.setViewportSize({width:440,height:440});await page.evaluate(()=>{window.skadiQA.state.settings.skadiSkin='classic';window.skadiQA.state.settings.reducedMotion=false;window.skadiQA.publish()});
  await page.emulateMedia({reducedMotion:'reduce'});check(await page.locator('.skadi-motion').evaluate(el=>getComputedStyle(el).animationName==='none'),'system reduced motion respected');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('.skadi-widget').hover();await page.getByRole('button',{name:'月汐设置',exact:true}).click();check(await page.evaluate(()=>window.skadiQA.calls.some(c=>c[0]==='settings')),'opens shared settings');
  await page.getByRole('button',{name:'收起月汐到托盘',exact:true}).click();check(await page.evaluate(()=>window.skadiQA.calls.some(c=>c[0]==='hide')),'hide calls shared tray bridge');
  await page.mouse.move(-10,-10);await page.waitForTimeout(300);await page.screenshot({path:'output/playwright/skadi-native-night.png'});
  return {checks:results.length,results};
}
