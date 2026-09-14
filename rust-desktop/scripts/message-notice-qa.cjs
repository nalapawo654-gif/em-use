// Run with the Playwright CLI run-code command against the local Vite fixture.
async page => {
 const base='http://127.0.0.1:5188', scenes=['aquarium','buddy','beaver','hamster','cultivation','battery','feidudu','fox','luckycat','dinosaur','skadi'];
 const errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
 for(const scene of scenes)for(const width of [440,300,190]){
  await page.setViewportSize({width,height:width});await page.goto(`${base}/tests/fixtures/desktop.html?scene=${scene}&width=${width}&messages=1&motion=off&random=off`);
  await page.locator('.message-bubble').waitFor();
  for(const selector of ['.message-launcher','.message-bubble']){
   const b=await page.locator(selector).boundingBox();if(!b||b.x<0||b.y<0||b.x+b.width>width+1||b.y+b.height>width+1)throw Error(`${scene}/${width} clipped ${selector}`);
  }
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-loaded]')].every(el=>el.getAttribute('data-loaded')==='true'));
  if(scene==='skadi')await page.locator('.skadi-figure[data-ready="true"]').waitFor();
  await page.screenshot({path:`rust-desktop/output/playwright/message-${scene}-${width}.png`,animations:'disabled'});
  await page.getByRole('button',{name:'收起消息气泡',exact:true}).click();
  if(await page.locator('.message-count').textContent()!=='1')throw Error('collapse cleared count');
  const popup=page.waitForEvent('popup');await page.locator('.message-launcher').click();const card=await popup;
  await card.getByRole('dialog',{name:'咚咚消息',exact:true}).waitFor();await card.locator('.message-detail').waitFor();
  await page.waitForFunction(()=>window.__messageFixtureState().messages.newCount===0);
  if(!await card.locator('.message-source-account').innerText().then(t=>t.includes('咚咚用户 A')))throw Error('Wrong source account');
  const cardBox=await card.locator('.message-inbox').boundingBox(),viewport=card.viewportSize();if(cardBox.width>viewport.width||cardBox.height>viewport.height)throw Error('Panel clipping');
  await card.keyboard.press('Escape').catch(e=>{if(!card.isClosed())throw e});await page.waitForFunction(()=>!document.querySelector('.message-open'));
  results.push({scene,width,bubble:true,prop:true,panel:true,localSeen:true});
 }
 // Same DongDong source survives quota login/logout and a pet remount.
 await page.goto(`${base}/tests/fixtures/desktop.html?scene=hamster&messages=1&motion=off&random=off`);await page.locator('.message-bubble').waitFor();
 await page.getByRole('button',{name:'收起消息气泡',exact:true}).click();
 await page.evaluate(async()=>{await window.emUse.login('manual');await window.emUse.logout();await window.emUse.settings({scene:'fox'});});
 await page.locator('.message-fox').waitFor();
 if(await page.locator('.message-bubble').isVisible())throw Error('Remount replay');
 const separate=await page.evaluate(()=>window.__messageFixtureState());if(separate.messages.account.id!=='dong-A'||separate.messages.items.length!==1||separate.account!==null)throw Error('Quota/message coupling');
 // New source clears the old account card; late acknowledgements cannot modify it.
 await page.evaluate(()=>window.__setMessages({epoch:'dong-C',status:'ready',message:'',account:{id:'dong-C',name:'咚咚用户 C'},items:[],newCount:0,revision:0,pausedUntil:0}));
 if(await page.locator('.message-launcher').isVisible())throw Error('Old account prop remains');
 if(!await page.evaluate(()=>window.emUse.ackMessages('dong-A',['msg-1']).then(()=>false,()=>true)))throw Error('Old epoch accepted');
 // Privacy mask applies to payload, grouping, and rendered text.
 await page.goto(`${base}/tests/fixtures/desktop.html?scene=hamster&messages=1&theme=night&motion=off`);await page.locator('.message-bubble').waitFor();
 await page.evaluate(()=>window.emUse.settings({messagePreview:false}));
 if(await page.locator('.message-bubble').innerText().then(t=>t.includes('张三')||t.includes('接口')))throw Error('Privacy leak in bubble');
 if(await page.evaluate(()=>window.emUse.getState().then(s=>JSON.stringify(s.messages).includes('接口'))))throw Error('Privacy leak in payload');
 const popup=page.waitForEvent('popup');await page.locator('.message-launcher').click();const card=await popup;await card.locator('.message-detail').waitFor();
 await card.screenshot({path:'rust-desktop/output/playwright/message-private-night.png',animations:'disabled'});
 if(await card.locator('.message-inbox').innerText().then(t=>t.includes('张三')||t.includes('接口')))throw Error('Privacy leak in card');
 await card.close();
 // The independent source and preferences appear in the dedicated settings tab.
 await page.setViewportSize({width:880,height:780});await page.goto(`${base}/tests/fixtures/desktop.html?view=settings&tab=messages&messages=1&width=800`);
 await page.locator('.message-account-comparison').waitFor();const accounts=await page.locator('.message-account-comparison').innerText();
 if(!accounts.includes('额度用户 B')||!accounts.includes('咚咚用户 A'))throw Error('Account labels missing');
 await page.getByRole('button',{name:'30 分钟',exact:true}).click();if(await page.evaluate(()=>window.__messageFixtureState().messages.status)!=='paused')throw Error('Pause failed');
 await page.getByRole('button',{name:'恢复提醒',exact:true}).click();
 await page.screenshot({path:'rust-desktop/output/playwright/message-settings.png',animations:'disabled'});
 if(errors.length)throw Error(JSON.stringify(errors));return {errors,results,accountIndependence:true,staleSourceRejected:true,privacy:true,settings:true};
}
