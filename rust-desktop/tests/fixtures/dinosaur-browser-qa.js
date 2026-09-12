// Run via Playwright CLI run-code against dinosaur-native.html at 440x440.
async page => {
  const results=[];
  const check=(ok,name)=>{if(!ok)throw Error(name);results.push(name)};
  await page.locator('.dinosaur-visual[data-loaded=true]').waitFor();
  const styles=()=>page.locator('.dinosaur-header').evaluate(el=>({opacity:getComputedStyle(el).opacity,visibility:getComputedStyle(el).visibility,pointer:getComputedStyle(el).pointerEvents}));
  await page.mouse.move(439,439);await page.waitForTimeout(250);
  // The full window is the hover boundary; remove hover with a synthetic outside position.
  await page.mouse.move(-10,-10);await page.waitForTimeout(250);
  check((await styles()).visibility==='hidden','idle chrome hidden');
  await page.getByRole('button',{name:'摸摸小恐龙的头',exact:true}).hover();await page.waitForTimeout(250);
  check((await styles()).opacity==='1','hover reveals chrome');
  await page.getByRole('button',{name:'小恐龙更多玩法',exact:true}).click();
  await page.mouse.move(-10,-10);await page.waitForTimeout(250);
  check(await page.getByRole('dialog').isVisible(),'panel persists outside hover');
  check(await page.locator('.dinosaur-resize').first().evaluate(el=>getComputedStyle(el).visibility==='hidden'),'panel hides resize');
  await page.getByRole('button',{name:'小恐龙换装',exact:true}).click();
  check(await page.getByRole('dialog').count()===1,'panels exclusive');
  await page.keyboard.press('Escape');check(await page.getByRole('dialog').count()===0,'Escape closes panel');
  const actions=[['摸摸小脑袋',8,2600],['奶茶摸鱼',1,4700],['咔嚓小饼干',5,4200],['元气蹦蹦',0,3200],['假装很忙',6,0],['抱紧小软垫',2,0],['盖毯打个盹',7,0]];
  for(const [label,frame,duration] of actions){
    await page.locator('.dinosaur-widget').hover();await page.getByRole('button',{name:'小恐龙更多玩法',exact:true}).click();
    await page.getByRole('dialog').getByRole('button').filter({hasText:label}).click();
    check(await page.locator('.dinosaur-character .dinosaur-visual').getAttribute('data-frame')===String(frame),label+' pose');
    const quota=await page.evaluate(()=>window.dinosaurQA.state.quota.percent);check(quota===100,label+' preserves quota');
    if(duration){await page.waitForTimeout(duration);check(await page.locator('.dinosaur-hud').count()===0,label+' auto completes')}
    else {check(await page.locator('.dinosaur-hud button').isVisible(),label+' explicit exit');await page.keyboard.press('Escape')}
  }
  // Real pointer sequence through shared gestures, while OS movement is mocked.
  await page.evaluate(()=>{window.dinosaurQA.calls.length=0});
  const box=await page.getByRole('button',{name:'摸摸小恐龙的头',exact:true}).boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+20,{steps:4});await page.mouse.up();
  check(await page.locator('.dinosaur-hud').count()===0,'drag suppresses pet click');
  check(await page.evaluate(()=>window.dinosaurQA.calls.some(c=>c[0]==='move')),'shared drag bridge called');
  for(const [p,f] of [[100,0],[70,1],[50,2],[10,3],[0,4]]){await page.evaluate(p=>window.dinosaurQA.setPercent(p),p);await page.waitForTimeout(60);check(await page.locator('.dinosaur-character .dinosaur-visual').getAttribute('data-frame')===String(f),'quota '+p+' pose');}
  for(const status of ['stale','expired','resetting','forbidden','unavailable','connecting','signed-out']){await page.evaluate(s=>window.dinosaurQA.setStatus(s),status);await page.waitForTimeout(60);const text=await page.locator('.dinosaur-quota').innerText();check(status==='stale'?text.includes('0'):text.includes('—'),'status '+status+' semantics');}
  await page.evaluate(()=>window.dinosaurQA.setPercent(100));
  for(const width of [440,300,190,180]){
    await page.setViewportSize({width,height:width});await page.evaluate(w=>window.dinosaurQA.setSize(w),width);await page.locator('.dinosaur-widget').hover();
    await page.getByRole('button',{name:'小恐龙更多玩法',exact:true}).click();
    await page.getByRole('dialog').getByRole('button').filter({hasText:'盖毯打个盹'}).click();
    const end=page.getByRole('button',{name:'小恐龙起床',exact:true});const b=await end.boundingBox();check(b&&b.y>=0&&b.y+b.height<=width,'exit fits '+width);await end.click();
    await page.getByRole('button',{name:'小恐龙换装',exact:true}).click();
    await page.getByRole('button',{name:'酷炭黑',exact:false}).click();
    check(await page.evaluate(()=>window.dinosaurQA.state.settings.dinosaurSkin)==='charcoal','skin saves '+width);
    await page.screenshot({path:'output/playwright/dinosaur-panel-'+width+'.png'});
    await page.getByRole('button',{name:'关闭小恐龙面板',exact:true}).click();
  }
  await page.setViewportSize({width:440,height:440});await page.evaluate(()=>{window.dinosaurQA.state.settings.theme='night';window.dinosaurQA.state.settings.dinosaurSkin='classic';window.dinosaurQA.publish()});
  await page.mouse.move(-10,-10);await page.waitForTimeout(300);await page.screenshot({path:'output/playwright/dinosaur-night.png'});
  await page.emulateMedia({reducedMotion:'reduce'});
  check(await page.locator('.dinosaur-sprite').evaluate(el=>getComputedStyle(el).animationName==='none'),'system reduced motion');
  return { checks: results.length, results };
}
