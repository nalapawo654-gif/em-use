async page=>{
 const base='http://127.0.0.1:5188';const toast=page.frameLocator('iframe[name="message-toast"]');await page.setViewportSize({width:750,height:440});
 await page.goto(`${base}/tests/fixtures/desktop.html?scene=hamster&canvas=wide&messages=1&random=off`,{waitUntil:'domcontentloaded'});await toast.locator('.message-bubble').waitFor();
 await toast.locator('.message-bubble').hover();await page.waitForTimeout(5500);if(!await toast.locator('.message-bubble').isVisible())throw Error('Hover did not pause');
 await page.mouse.move(740,439);await page.waitForFunction(()=>!window.__messageFixtureState().messageToast,{},{timeout:7500});
 if(await page.locator('.message-count').textContent()!=='1')throw Error('Timeout marked viewed');
 // Three conversations, no accidental acknowledgements while showing the conversation list.
 await page.evaluate(()=>{const s=window.__messageFixtureState().messages,one=s.items[0];s.items=[{...one,key:'3',conversation:'team',title:'研发群',sender:'李四',body:'这是群里的最新提醒',mentioned:true},{...one,key:'2'},{...one,key:'4',conversation:'same-name',sender:'张三',title:'张三'},one];s.newCount=4;s.revision=4;window.__setMessages(s)});
 const waiting=page.waitForEvent('popup');await page.locator('.message-launcher').click();const card=await waiting;await card.locator('.message-group').first().waitFor();
 if(await card.locator('.message-group').count()!==3)throw Error('Wrong grouping');
 if(await page.evaluate(()=>window.__messageFixtureState().messages.newCount)!==4)throw Error('List view acknowledged hidden messages');
 await card.screenshot({path:'rust-desktop/output/playwright/message-conversations.png',animations:'disabled'});
 await card.locator('.message-group').filter({hasText:'研发群'}).click();await page.waitForFunction(()=>window.__messageFixtureState().messages.newCount===3);
 await page.evaluate(()=>{const s=window.__messageFixtureState().messages;s.items.unshift({...s.items[0],key:'5',conversation:'another',title:'其他同事',body:'新会话不会打断阅读'});s.newCount++;s.revision++;window.__setMessages(s)});
 if(await card.locator('.message-detail').innerText().then(t=>!t.includes('研发群')))throw Error('New message interrupted current conversation');
 await card.getByRole('button',{name:'全部会话',exact:true}).click();if(await card.locator('.message-group').count()!==4)throw Error('New conversation lost');
 await card.close();
 // Message bubble has priority; after it is dismissed the update entry reappears.
 await page.goto(`${base}/tests/fixtures/desktop.html?scene=hamster&canvas=wide&messages=1&update=available&fresh=1&motion=off&random=off`,{waitUntil:'domcontentloaded'});await toast.locator('.message-bubble').waitFor();
 await page.waitForFunction(()=>document.querySelector('.pet-update-notice')?.getAttribute('style')?.includes('display: none'),{},{timeout:2000});
 await toast.getByRole('button',{name:'收起消息气泡',exact:true}).click();await page.locator('.update-letter-button').waitFor();await page.locator('.update-letter-button').click();
 await page.getByRole('dialog',{name:/版本更新/}).waitFor();if(await page.locator('.message-launcher').isVisible())throw Error('Update card overlaps message launcher');
 await page.keyboard.press('Escape');await page.locator('.message-launcher').waitFor();
 // A gameplay panel queues a new arrival until the panel is closed.
 await page.mouse.move(220,220);await page.locator('.hamster-header button').first().click();
 await page.evaluate(()=>{const s=window.__messageFixtureState().messages;s.items.unshift({...s.items[0],key:'later',body:'待玩法结束后提示'});s.revision++;s.newCount++;window.__setMessages(s)});
 if(await toast.locator('.message-bubble').isVisible())throw Error('Gameplay interrupted');await page.keyboard.press('Escape');await toast.locator('.message-bubble').waitFor();
 if(!await toast.locator('.message-bubble').innerText().then(t=>t.includes('待玩法结束')))throw Error('Deferred message lost');
 return{hoverPause:true,autoCollapseKeepsCount:true,grouping:true,visibleOnlyAcknowledgement:true,incomingKeepsCurrentConversation:true,updatePriority:true,gameplayDeferred:true};
}
