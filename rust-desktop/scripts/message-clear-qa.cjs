// Run via Playwright CLI against the local fixture on port 5188.
async page => {
  await page.goto('http://127.0.0.1:5188/tests/fixtures/desktop.html?view=messages&width=350')
  await page.setViewportSize({width:350,height:360})
  await page.getByRole('button',{name:'打开咚咚',exact:true}).waitFor()
  await page.evaluate(()=>{
    const items=['研发群','上线讨论','消息同事'].map((title,i)=>({key:'clear-'+i,conversation:'chat-'+i,title,sender:'同事',body:'待处理的提醒 '+i,at:Date.now()-i*1000,kind:'text',fresh:true,mentioned:false}))
    window.__setMessages({epoch:'clear-demo',status:'ready',message:'',account:{id:'demo',name:'演示账户'},revision:1,newCount:3,pausedUntil:0,items})
  })
  await page.getByRole('button',{name:'清空提醒',exact:true}).waitFor()
  await page.screenshot({path:'output/playwright/message-clear-list.png'})
  await page.getByRole('button').filter({hasText:'研发群'}).click()
  await page.getByRole('button',{name:'清除提醒',exact:true}).waitFor()
  await page.setViewportSize({width:350,height:240})
  await page.screenshot({path:'output/playwright/message-clear-conversation.png'})
  const bounds=await page.getByRole('button',{name:'清除提醒',exact:true}).boundingBox()
  if(!bounds || bounds.x<0 || bounds.x+bounds.width>350 || bounds.y+bounds.height>240)throw Error('Clear button clipped')
  await page.getByRole('button',{name:'清除提醒',exact:true}).click()
  await page.waitForFunction(()=>window.__messageFixtureState().messages.items.length===2)
  if(await page.evaluate(()=>window.__messageFixtureState().messages.items.some(i=>i.conversation==='chat-0')))throw Error('Conversation not removed')
  await page.evaluate(()=>document.body.dataset.clearMessagesFail='true')
  await page.getByRole('button',{name:'清空提醒',exact:true}).click()
  await page.getByRole('alert').filter({hasText:'提醒未能清除'}).waitFor()
  if(await page.evaluate(()=>window.__messageFixtureState().messages.items.length)!==2)throw Error('Failure cleared reminders')
  await page.evaluate(()=>{
    delete document.body.dataset.clearMessagesFail
    const base=window.__messageFixtureState().messages.items[0]
    window.__clearRaceMessage={...base,key:'racing',conversation:'new-chat',title:'新来信',at:Date.now(),fresh:true}
  })
  await page.getByRole('button',{name:'清空提醒',exact:true}).click()
  await page.waitForFunction(()=>window.__messageFixtureState().messages.items.length===1)
  if(await page.evaluate(()=>window.__messageFixtureState().messages.items[0].key)!=='racing')throw Error('New arrival lost')
  await page.getByRole('button',{name:'清空提醒',exact:true}).click()
  await page.waitForFunction(()=>window.__messageFixtureState().messages.items.length===0 && window.__messageFixtureState().messages.newCount===0)
  if(await page.locator('body').getAttribute('data-dongdong-opened'))throw Error('Clear opened DongDong')
  await page.getByRole('button',{name:'收起消息卡片',exact:true}).waitFor()
  return {clearConversation:true,clearAll:true,errorRetry:true,racingMessageRetained:true,smallWindow:true,noDongDongLaunch:true}
}
