async page => {
 const scenes=['feidudu','cultivation','beaver','hamster','dinosaur','skadi'],passed=[];
 const startNames={feidudu:'肥嘟嘟陪你加班',cultivation:'给他梳头',beaver:'海狸鼠梳毛',hamster:'仓鼠盖被子',dinosaur:'小恐龙假装很忙',skadi:'让月汐陪你工作'};
 const toast=page.frameLocator('iframe[name="message-toast"]');
 await page.setViewportSize({width:750,height:440});
 for(const scene of scenes){
  await page.bringToFront();
  await page.goto(`http://127.0.0.1:5188/tests/fixtures/desktop.html?scene=${scene}&canvas=wide&messages=1&random=off&motion=off`,{waitUntil:'domcontentloaded'});
  await page.locator('.character-mail-art[data-ready=true]').waitFor();await toast.locator('.message-bubble').waitFor();
  await toast.getByRole('button',{name:'收起消息气泡',exact:true}).click();
  await page.mouse.move(740,430);await page.locator(`.${scene}-widget`).hover({position:{x:200,y:190}});
  await page.getByRole('button',{name:startNames[scene],exact:true}).click();
  await page.evaluate(()=>{const s=window.__messageFixtureState().messages;s.items.unshift({...s.items[0],key:'busy-new',body:'玩法期间收到的新提醒'});s.newCount++;s.revision++;window.__setMessages(s)});
  await page.waitForFunction(()=>document.querySelector('.message-count')?.textContent==='2');
  if(!await page.locator('.message-launcher').isVisible()||await toast.locator('.message-bubble').isVisible())throw Error(`${scene}: busy entry / deferred bubble`);
  const before=await page.locator(`.${scene}-widget`).evaluate((e,scene)=>{const s=e.__vueParentComponent.setupState;return scene==='beaver'?s.scene.updateBlocked:s.play.action},scene);
  await page.evaluate(()=>{delete document.body.dataset.gesture;delete document.body.dataset.gestureMoved});
  const pending=page.waitForEvent('popup');await page.locator('.message-launcher').click();const card=await pending;
  await card.locator('.message-detail').first().waitFor();await card.getByRole('button',{name:'打开咚咚',exact:true}).click();
  if(await page.evaluate(()=>document.body.dataset.dongdongOpened)!=='1')throw Error(`${scene}: bridge not called`);
  await card.screenshot({path:`rust-desktop/output/playwright/character-mail-card-${scene}.png`});
  await card.getByRole('button',{name:'收起',exact:true}).click();await page.bringToFront();
  await page.waitForFunction(()=>!document.querySelector('.message-open'));
  const after=await page.locator(`.${scene}-widget`).evaluate((e,scene)=>{const s=e.__vueParentComponent.setupState;return scene==='beaver'?s.scene.updateBlocked:s.play.action},scene);
  if(before!==after||await page.evaluate(()=>document.body.dataset.gesture))throw Error(`${scene}: mail click changed action or dragged`);
  await page.evaluate(()=>{const s=window.__messageFixtureState().messages;s.items.unshift({...s.items[0],key:'after-card',fresh:true,body:'结束玩法后再提示'});s.newCount=1;s.revision++;window.__setMessages(s)});
  await page.keyboard.press('Escape');await toast.locator('.message-bubble').waitFor();
  if(!await toast.locator('.message-bubble').innerText().then(t=>t.includes('结束玩法后再提示')))throw Error(`${scene}: missing deferred arrival`);
  await toast.getByRole('button',{name:'收起消息气泡',exact:true}).click();
  // Return keyboard focus from the external toast frame before exposing chrome.
  await page.bringToFront();await page.locator(`.${scene}-widget`).focus();await page.keyboard.press('Tab');
  // Wardrobe blocks only the entry, closing it restores the same prop.
  await page.mouse.move(740,430);await page.locator(`.${scene}-widget`).hover({position:{x:200,y:190}});await page.locator(`.${scene}-header button`).nth(1).click();
  if(await page.locator('.message-launcher').isVisible())throw Error(`${scene}: panel overlap`);
  await page.keyboard.press('Escape');await page.locator('.message-launcher').waitFor();
  await page.evaluate(()=>window.emUse.logout());await page.locator('.message-launcher').waitFor();
  await page.evaluate(()=>window.emUse.settings({messagePausedUntil:Date.now()+1800000}));await page.locator('.message-muted-badge').waitFor();
  await page.evaluate(()=>window.emUse.settings({messagePausedUntil:0,messagePreview:false}));
  const privatePending=page.waitForEvent('popup');await page.locator('.message-launcher').focus();await page.keyboard.press('Enter');const privateCard=await privatePending;
  await privateCard.locator('.message-detail').first().waitFor();if((await privateCard.locator('.message-inbox').innerText()).includes('张三'))throw Error(`${scene}: privacy leak`);await privateCard.close();
  await page.evaluate(()=>window.__setMessages({epoch:'new-source',status:'waiting',revision:1,message:'等待咚咚',newCount:0,items:[],pausedUntil:0}));
  if(await page.locator('.message-launcher').isVisible())throw Error(`${scene}: stale account entry`);
  passed.push({scene,busyEntry:true,deferred:true,actionPreserved:true,panelRestored:true,keyboard:true,privacy:true,quotaLogoutIndependent:true,sourceSwitchClears:true});
 }
 return passed;
}
