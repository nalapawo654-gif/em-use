// Playwright CLI run-code against the local Vite fixture on port 5188.
async page => {
 for(const old of page.context().pages())if(old!==page&&old.url().includes('/tests/fixtures/desktop.html?view=messages'))await old.close();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5188/tests/fixtures/desktop.html?scene=hamster&canvas=wide&messages=1&motion=off&random=off');
 await page.locator('.message-launcher').waitFor();
 await page.evaluate(()=>{
  const s=window.__messageFixtureState().messages,base=s.items[0];
  s.items=[['李四','接口文档已更新，新增字段用浅黄色标出来了。'],['张三','收到，我下午把联调结果同步到群里。'],['王五','[文件] 接口变更说明.pdf']].map(([sender,body],i)=>({...base,key:'group-'+i,title:'产品研发讨论群',sender,body,at:Date.now()-i*60000,mentioned:i===0}));
  s.revision++;s.newCount=3;window.__setMessages(s);
 });
 const toast=page.frameLocator('iframe[name="message-toast"]');await toast.locator('.message-bubble-total').waitFor();
 if(await toast.locator('.message-bubble-total').innerText()!=='3 条')throw Error('Missing merged count');
 const popup=page.waitForEvent('popup');await page.locator('.message-launcher').click();const card=await popup;
 card.on('pageerror',e=>errors.push(e.message));await card.locator('.message-detail').first().waitFor();
 await card.setViewportSize({width:350,height:360});
 if(await card.locator('.message-conversation-copy h2').innerText()!=='产品研发讨论群'||await card.locator('.message-detail').count()!==3)throw Error('Messages not merged');
 if((await card.locator('.message-inbox').innerText()).split('产品研发讨论群').length!==2)throw Error('Repeated group heading');
 await card.screenshot({path:'output/playwright/message-conversation-day.png'});
 await page.evaluate(()=>{const s=window.__messageFixtureState().messages;s.items.unshift({...s.items[0],key:'private',conversation:'private',fresh:true,mentioned:false,title:'陈晨',sender:'陈晨',body:'明天的评审时间改到十点，可以吗？',at:Date.now()});s.revision++;s.newCount=s.items.filter(i=>i.fresh).length;window.__setMessages(s)});
 await card.getByRole('button',{name:'返回全部会话'}).waitFor();
 if(await card.locator('.message-conversation-copy h2').innerText()!=='产品研发讨论群')throw Error('Incoming conversation interrupted reading');
 await card.getByRole('button',{name:'返回全部会话'}).click();await card.locator('.message-group').first().waitFor();
 if(await card.locator('.message-group').count()!==2)throw Error('Conversation rows not merged');
 await card.screenshot({path:'output/playwright/message-conversations-list.png'});
 await card.locator('.message-group').filter({hasText:'产品研发讨论群'}).click();
 await page.evaluate(()=>window.emUse.settings({theme:'night'}));
 await card.locator('.night').waitFor();await card.screenshot({path:'output/playwright/message-conversation-night.png'});
 await page.evaluate(()=>window.emUse.settings({messagePreview:false}));
 await card.locator('.message-conversation-copy h2').filter({hasText:'新消息'}).waitFor();
 if(/产品研发|李四|张三|王五|接口|@我/.test(await card.locator('.message-inbox').innerText()))throw Error('Privacy leak');
 await card.getByRole('button',{name:'返回全部会话'}).click();
 if(/产品研发|陈晨|接口/.test(await card.locator('.message-inbox').innerText()))throw Error('List privacy leak');
 await page.evaluate(()=>{const s=window.__messageFixtureState().messages;s.items=[{...s.items[0],title:'很长的会话名称用于检查窄窗口中的省略和按钮可达性',body:'单条消息正文。'}];s.revision++;window.__setMessages(s)});
 await page.evaluate(()=>window.emUse.settings({messagePreview:true,theme:'day'}));
 await card.setViewportSize({width:350,height:240});await card.locator('.message-detail').waitFor();
 const bounds=await card.evaluate(()=>{const footer=document.querySelector('.message-inbox-footer').getBoundingClientRect();return {bottom:footer.bottom,overflow:document.documentElement.scrollWidth>innerWidth}});
 if(bounds.bottom>240||bounds.overflow)throw Error('Small card clipped');
 await card.screenshot({path:'output/playwright/message-conversation-single.png'});
 await card.getByRole('button',{name:'打开咚咚',exact:true}).click();
 if(await page.evaluate(()=>document.body.dataset.dongdongOpened)!=='1')throw Error('Open DongDong failed');
 await card.close();
 if(errors.length)throw Error(JSON.stringify(errors));return {mergedGroup:true,mergedToast:true,stableReading:true,conversationList:true,privacy:true,smallCard:true,openDongdong:true,errors};
}
