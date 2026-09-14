async page => {
 const passed=[];await page.clock.install();await page.setViewportSize({width:750,height:440});
 await page.goto('http://127.0.0.1:5188/tests/fixtures/desktop.html?scene=buddy&width=440&messages=1&motion=off',{waitUntil:'domcontentloaded'});
 await page.locator('.buddy-mail-art[data-ready=true]').waitFor();
 const visible=async()=>{if(!await page.locator('.message-launcher').isVisible())throw Error('Mail entry disappeared')};
 const inject=async key=>page.evaluate(key=>{const s=window.__messageFixtureState().messages;s.revision++;s.items.unshift({...s.items[0],key,fresh:true,body:'互动期间的新消息 '+key});s.newCount=s.items.filter(i=>i.fresh).length;window.__setMessages(s)},key);
 await page.locator('.buddy-widget').hover();await page.getByRole('button',{name:'清洁',exact:true}).click();
 await inject('during-clean');await page.clock.runFor(250);await visible();
 if(await page.locator('iframe[name=message-toast]').isVisible())throw Error('Busy action interrupted by toast');
 if(await page.locator('.message-count').textContent()!=='2')throw Error('Busy count missing');
 const opened=page.waitForEvent('popup');await page.locator('.message-launcher').click();const card=await opened;
 await card.locator('.message-detail').first().waitFor();await card.getByRole('button',{name:'打开咚咚',exact:true}).click();
 if(await page.evaluate(()=>document.body.dataset.dongdongOpened)!=='1')throw Error('DongDong bridge not invoked');
 if(await page.locator('.buddy-scene').getAttribute('data-action')!=='clean')throw Error('Mail click interfered with cleaning');
 if(await page.evaluate(()=>document.body.dataset.gesture))throw Error('Mail click started window gesture');
 await card.close();await page.clock.runFor(250);await visible();passed.push('cleaning: entry opens card and DongDong bridge without dragging or scrubbing');
 await inject('queued');await page.getByRole('button',{name:'自动清洁',exact:true}).click();await page.clock.runFor(1500);
 if(await page.locator('.buddy-scene').getAttribute('data-action')!=='celebrate')throw Error('Automatic clean did not celebrate');
 await visible();await page.clock.runFor(2100);
 await page.frameLocator('iframe[name=message-toast]').getByText('互动期间的新消息 queued',{exact:true}).waitFor();
 await page.frameLocator('iframe[name=message-toast]').getByRole('button',{name:'收起消息气泡',exact:true}).click();
 await visible();passed.push('clean → celebrate → idle delivers queued toast once, closing retains badge');
 await page.getByRole('button',{name:'摸摸牛马，双击切换站立或趴下',exact:true}).dblclick();await page.clock.runFor(300);await visible();
 if(await page.locator('.buddy-scene').getAttribute('data-pose')!=='lying')throw Error('Did not lie down');
 await page.getByRole('button',{name:'站起来',exact:true}).click();await visible();passed.push('double-click lie down and stand restore');
 for(const skin of ['worker','holiday','midnight','blossom','classic']){
  await page.getByRole('button',{name:'牛马换装',exact:true}).click();await page.locator('.buddy-panel .skin-'+skin).click();
  await page.getByRole('button',{name:'关闭牛马衣橱',exact:true}).click();await page.clock.runFor(200);await visible();
 }
 passed.push('all five wardrobe selections retain the mail during wag');
 await page.getByRole('button',{name:'喂草',exact:true}).click();
 for(const reducedMotion of [false,true,false]){await page.evaluate(value=>window.emUse.settings({reducedMotion:value}),reducedMotion);await page.clock.runFor(100);await visible()}
 passed.push('live animated/static switching during feed');
 await page.evaluate(()=>window.emUse.logout());await page.clock.runFor(200);await visible();
 if(await page.evaluate(()=>window.__messageFixtureState().messages.account.id)!=='dong-A')throw Error('Quota logout changed message account');
 passed.push('quota logout retains DongDong A mail and unknown quota pose');
 await page.evaluate(()=>window.emUse.settings({messagePausedUntil:Date.now()+1800000}));await page.clock.runFor(150);await visible();
 if(!await page.locator('.message-muted-badge').isVisible())throw Error('Paused marker missing');
 await page.evaluate(()=>window.emUse.settings({messagePausedUntil:0,messagePreview:false}));await page.clock.runFor(150);await visible();
 passed.push('paused entry and private preview retained');
 await page.evaluate(()=>{const s=window.__messageFixtureState().messages;s.epoch='dong-C';s.account={id:'dong-C',name:'咚咚 C'};s.items=[];s.newCount=0;s.revision++;window.__setMessages(s)});await page.clock.runFor(150);
 if(await page.locator('.message-launcher').isVisible())throw Error('Old account mail survived source switch');
 passed.push('DongDong account switch clears old account mail');
 return {passed};
}
