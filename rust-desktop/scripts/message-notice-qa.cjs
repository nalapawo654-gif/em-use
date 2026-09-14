// Run with the Playwright CLI run-code command against the local Vite fixture.
async page => {
 const base='http://127.0.0.1:5188';
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const toast=page.frameLocator('iframe[name="message-toast"]');
 await page.setViewportSize({width:750,height:440});
 // Visual placement is covered by message-notice-layout-qa.cjs.
 // Same DongDong source survives quota login/logout and a pet remount.
 await page.goto(`${base}/tests/fixtures/desktop.html?scene=hamster&canvas=wide&messages=1&motion=off&random=off`,{waitUntil:'domcontentloaded'});await toast.locator('.message-bubble').waitFor();
 await toast.getByRole('button',{name:'收起消息气泡',exact:true}).click();
 await page.evaluate(async()=>{await window.emUse.login('manual');await window.emUse.logout();await window.emUse.settings({scene:'fox'});});
 await page.locator('.message-fox').waitFor();
 if(await toast.locator('.message-bubble').isVisible())throw Error('Remount replay');
 const separate=await page.evaluate(()=>window.__messageFixtureState());if(separate.messages.account.id!=='dong-A'||separate.messages.items.length!==1||separate.account!==null)throw Error('Quota/message coupling');
 // New source clears the old account card; late acknowledgements cannot modify it.
 await page.evaluate(()=>window.__setMessages({epoch:'dong-C',status:'ready',message:'',account:{id:'dong-C',name:'咚咚用户 C'},items:[],newCount:0,revision:0,pausedUntil:0}));
 if(await page.locator('.message-launcher').isVisible())throw Error('Old account prop remains');
 if(!await page.evaluate(()=>window.emUse.ackMessages('dong-A',['msg-1']).then(()=>false,()=>true)))throw Error('Old epoch accepted');
 // Privacy mask applies to payload, grouping, and rendered text.
 await page.goto(`${base}/tests/fixtures/desktop.html?scene=hamster&canvas=wide&messages=1&theme=night&motion=off`);await toast.locator('.message-bubble').waitFor();
 await page.evaluate(()=>window.emUse.settings({messagePreview:false}));
 if(await toast.locator('.message-bubble').innerText().then(t=>t.includes('张三')||t.includes('接口')))throw Error('Privacy leak in bubble');
 if(await page.evaluate(()=>window.emUse.getState().then(s=>JSON.stringify(s.messages).includes('接口'))))throw Error('Privacy leak in payload');
 const popup=page.waitForEvent('popup');await page.locator('.message-launcher').click();const card=await popup;await card.locator('.message-detail').waitFor();
 await card.screenshot({path:'rust-desktop/output/playwright/message-private-night.png',animations:'disabled'});
 if(await card.locator('.message-inbox').innerText().then(t=>t.includes('张三')||t.includes('接口')))throw Error('Privacy leak in card');
 // A failed native open must stay visible and allow retry.
 await page.evaluate(()=>{window.emUse.openDongdong=async()=>{throw '未找到本机咚咚，请先安装或启动咚咚。'}});
 await card.getByRole('button',{name:'打开咚咚',exact:true}).click();
 if(!await card.locator('[role=alert]').innerText().then(t=>t.includes('未找到本机咚咚')))throw Error('Launch failure hidden');
 await page.evaluate(()=>{window.emUse.openDongdong=async()=>{document.body.dataset.retry='ok'}});
 await card.getByRole('button',{name:'打开咚咚',exact:true}).click();
 if(await page.evaluate(()=>document.body.dataset.retry)!=='ok')throw Error('Launch retry failed');
 await card.close();
 // The independent source and preferences appear in the dedicated settings tab.
 await page.setViewportSize({width:880,height:780});await page.goto(`${base}/tests/fixtures/desktop.html?view=settings&tab=messages&messages=1&width=800`);
 await page.locator('.message-account-comparison').waitFor();const accounts=await page.locator('.message-account-comparison').innerText();
 if(!accounts.includes('额度用户 B')||!accounts.includes('咚咚用户 A'))throw Error('Account labels missing');
 await page.getByRole('button',{name:'30 分钟',exact:true}).click();if(await page.evaluate(()=>window.__messageFixtureState().messages.status)!=='paused')throw Error('Pause failed');
 await page.getByRole('button',{name:'恢复提醒',exact:true}).click();
 await page.screenshot({path:'rust-desktop/output/playwright/message-settings.png',animations:'disabled'});
 if(errors.length)throw Error(JSON.stringify(errors));return {errors,launchFailureAndRetry:true,accountIndependence:true,staleSourceRejected:true,privacy:true,settings:true};
}
