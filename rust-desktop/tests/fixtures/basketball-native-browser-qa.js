async page => {
  const checks=[], errors=[];page.on('pageerror',e=>errors.push(e.message));
  const defaults=await page.evaluate(async()=> (await import('/src/shared/types.ts')).DEFAULT_SETTINGS);
  await page.addInitScript(defaults=>{
    const listeners=new Set(),stamp=Date.now();
    const state={settings:{...defaults,scene:'basketball',theme:'day',reducedMotion:true,calendarEnabled:false,messageEnabled:false,windowWidth:440},status:'ready',syncing:false,message:'浏览器验收模拟快照',quota:{percent:75,remaining:225,limit:300,used:75,day:'2026-10-23',receivedAt:stamp,serverAt:new Date(stamp).toISOString(),estimatedAt:new Date(stamp).toISOString()},account:{id:'qa-cloud',name:'验收账户'},version:'QA',persistentLogin:false,loginOpen:false};
    const emit=()=>listeners.forEach(fn=>fn(structuredClone(state))),noop=async()=>{};
    window.__hoopQa={state,gestures:[],set(patch){Object.assign(state,patch);emit()},settings(patch){Object.assign(state.settings,patch);emit()}};
    window.emUse={getState:async()=>structuredClone(state),onState:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},settings:async patch=>{Object.assign(state.settings,patch);emit()},beginGesture:async mode=>{window.__hoopQa.gestures.push(mode);return 1},moveGesture:noop,endGesture:noop,hide:noop,quit:noop,refresh:noop,refreshCodex:noop,openSettings:noop,login:noop,logout:noop,openPortal:noop,openReleases:noop,screenshot:async()=>null};
  },defaults);
  const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
  await page.setViewportSize({width:440,height:440});await page.goto('http://127.0.0.1:5178/?view=widget');
  const widget=page.locator('.hoop-widget'),ball=page.locator('.hoop-ball-hit');await widget.waitFor();
  for(const size of [440,300,190,180]){
    await page.setViewportSize({width:size,height:size});await page.evaluate(size=>window.__hoopQa.settings({windowWidth:size}),size);
    await page.mouse.move(-5,-5);await page.evaluate(()=>document.activeElement?.blur());
    assert(await page.locator('.pet-arc').evaluate(el=>getComputedStyle(el).visibility)==='hidden',`${size} idle toolbar hidden`);
    assert((await widget.boundingBox()).width===size,`${size} native square fit`);
    await widget.hover();await page.getByRole('button',{name:'投篮更多玩法',exact:true}).click();
    const close=page.getByRole('button',{name:'关闭投篮面板'}),bounds=await close.boundingBox();
    assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=size&&bounds.y+bounds.height<=size,`${size} close reachable`);
    await page.screenshot({path:`output/playwright/basketball-${size}-panel.png`});
    await close.click();await ball.click();
    const r=await widget.boundingBox(),scale=r.width/440,x=r.x+184*scale,y=r.y+302*scale;
    await page.evaluate(()=>window.__hoopQa.gestures=[]);
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-17.14*scale,y+60.27*scale,{steps:10});
    await page.screenshot({path:`output/playwright/basketball-${size}-aim.png`});
    await page.mouse.up();await page.waitForFunction(()=>document.querySelector('.hoop-widget').dataset.mode==='ready');
    assert((await page.evaluate(()=>window.__hoopQa.gestures)).length===0,`${size} shoot must not drag window`);
    assert(await page.locator('.hoop-scoreboard strong').innerText()==='04',`${size} proportional pointer shot`);
    await page.keyboard.press('Escape');
    await page.mouse.move(-5,-5);await page.screenshot({path:`output/playwright/basketball-${size}-day.png`});
    await page.evaluate(()=>window.__hoopQa.settings({theme:'night'}));await page.screenshot({path:`output/playwright/basketball-${size}-night.png`});
    await page.evaluate(()=>window.__hoopQa.settings({theme:'day'}));checks.push(`${size}px: hidden toolbar, reachable panel close, successful shot, no window drag, day/night`);
  }
  await page.setViewportSize({width:440,height:440});await page.evaluate(()=>window.__hoopQa.settings({windowWidth:440}));
  const body=page.locator('.hoop-player-hit'),r=await body.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+25,r.y+r.height/2+8,{steps:5});await page.mouse.up();
  assert((await page.evaluate(()=>window.__hoopQa.gestures)).includes('move'),'body delegates to shared window move');
  assert(!(await page.locator('.hoop-speech').innerText()).includes('好球'),'drag does not also high-five');checks.push('body uses shared gesture and suppresses post-drag click');
  await page.evaluate(()=>{
    const qa=window.__hoopQa,now=Date.now();qa.set({codex:{status:'ready',syncing:false,message:'测试快照',receivedAt:now,account:{id:'qa-codex',name:'验收账户',plan:'测试'},buckets:[{id:'codex',name:'Codex',plan:null,windows:[{id:'primary',remainingPercent:65,windowDurationMins:300,resetsAt:Math.floor(now/1000)+7200},{id:'secondary',remainingPercent:20,windowDurationMins:10080,resetsAt:Math.floor(now/1000)+86400}]}]}});qa.settings({quotaSource:'codex',codexEnabled:true});
  });
  await page.waitForFunction(()=>document.querySelector('.hoop-widget').dataset.level==='3');
  assert((await page.locator('.hoop-quota').innerText()).includes('65%')&&(await page.locator('.hoop-quota').innerText()).includes('20%'),'both Codex windows displayed');
  for(const size of [440,300,190,180]){
    await page.setViewportSize({width:size,height:size});await page.evaluate(size=>window.__hoopQa.settings({windowWidth:size}),size);
    const fit=await page.locator('.codex-readout').evaluate(el=>[...el.querySelectorAll('.codex-readout-label,.codex-readout-value,.codex-readout-heading')].every(node=>{const r=node.getBoundingClientRect();return r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}));assert(fit,`${size} Codex readout fit`);
    await page.screenshot({path:`output/playwright/basketball-${size}-codex.png`});
  }
  checks.push('Codex dual-window display, lower-window distance, all sizes fit');
  await page.evaluate(()=>{const qa=window.__hoopQa;qa.state.codex.buckets[0].windows=[qa.state.codex.buckets[0].windows[1]];qa.set({codex:qa.state.codex})});
  assert(await page.locator('.codex-readout-window').count()===1,'weekly-only no invented window');
  await page.evaluate(()=>{const qa=window.__hoopQa;qa.state.codex.status='stale';qa.set({codex:qa.state.codex})});
  assert((await page.locator('.hoop-quota').innerText()).includes('待更新'),'stale labeled');
  await page.evaluate(()=>{const qa=window.__hoopQa;qa.state.codex.status='signed-out';qa.state.codex.account=null;qa.state.codex.buckets=[];qa.set({codex:qa.state.codex})});
  assert((await page.locator('.hoop-quota').innerText()).includes('—'),'signed out unknown');
  checks.push('weekly-only, stale and signed-out semantics');
  await page.evaluate(()=>window.__hoopQa.settings({quotaSource:'eastmoney'}));await ball.click();await page.keyboard.press('Escape');
  await page.evaluate(()=>window.__hoopQa.settings({scene:'aquarium'}));assert(await page.locator('.hoop-widget').count()===0,'scene unmounted');
  await page.evaluate(()=>window.__hoopQa.settings({scene:'basketball'}));await widget.waitFor();assert(await widget.getAttribute('data-mode')==='idle','scene remount starts idle');checks.push('switching pets clears gameplay');
  assert(errors.length===0,errors.join('\n'));
  return {passed:checks.length,checks,errors,scope:'browser with native bridge fixture; no actual OS/account verification'};
}
