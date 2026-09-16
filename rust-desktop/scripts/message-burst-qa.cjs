// Playwright CLI run-code against the local Vite fixture on port 5188.
async page => {
  await page.setViewportSize({width:800,height:480})
  await page.goto('http://127.0.0.1:5188/tests/fixtures/desktop.html?scene=hamster&canvas=wide&messages=1&motion=off&random=off')
  const toast=page.frameLocator('iframe[name="message-toast"]')
  await toast.getByRole('button',{name:'查看咚咚消息',exact:true}).waitFor()
  await toast.getByRole('button',{name:'查看咚咚消息',exact:true}).hover()
  const shows=()=>page.locator('body').getAttribute('data-message-toast-shows')
  const firstShows=await shows()
  const original=await toast.locator('.message-bubble').elementHandle()
  async function add(key,conversation='chat-1') {
    await page.evaluate(({key,conversation})=>{
      const s=window.__messageFixtureState().messages,base=s.items[0]
      s.items.unshift({...base,key,conversation,at:Date.now(),fresh:true,body:'连续消息 '+key})
      s.revision++;s.newCount=s.items.filter(i=>i.fresh).length;window.__setMessages(s)
    },{key,conversation})
  }
  for(const key of ['two','three','four']) await add(key)
  await toast.getByRole('button',{name:'查看咚咚消息',exact:true}).filter({hasText:'连续消息 four'}).waitFor()
  if(await toast.locator('.message-bubble-total').innerText()!=='4 条')throw Error('Burst count not merged')
  if(await shows()!==firstShows || !await original.evaluate(el=>el.isConnected))throw Error('Burst recreated or re-showed the toast')
  // Retention drops the original anchor; the visible conversation must survive.
  await page.evaluate(()=>{const s=window.__messageFixtureState().messages;s.items=s.items.slice(0,2);s.revision++;s.newCount=2;window.__setMessages(s)})
  await toast.locator('.message-bubble-total').filter({hasText:'2 条'}).waitFor()
  await toast.getByRole('button',{name:'收起消息气泡',exact:true}).click()
  await page.waitForFunction(()=>!window.__messageFixtureState().messageToast)
  await add('after-close')
  await page.waitForFunction(()=>document.querySelector('.message-count')?.textContent==='3')
  if(await shows()!==firstShows || await page.evaluate(()=>!!window.__messageFixtureState().messageToast))throw Error('Closed burst reopened')
  await add('other','other-chat')
  await toast.getByRole('button',{name:'查看咚咚消息',exact:true}).filter({hasText:'连续消息 other'}).waitFor()
  if(Number(await shows())!==Number(firstShows)+1)throw Error('Other conversation was suppressed')
  await page.mouse.move(790,470)
  await page.waitForFunction(()=>!window.__messageFixtureState().messageToast,{},{timeout:8000})
  await add('after-timeout','other-chat')
  await page.waitForFunction(()=>document.querySelector('.message-count')?.textContent==='5')
  if(Number(await shows())!==Number(firstShows)+1 || await page.evaluate(()=>!!window.__messageFixtureState().messageToast))throw Error('Timed-out burst reopened')
  return {sameToast:true,latestSummary:true,mergedCount:true,anchorEviction:true,closeQuiet:true,timeoutQuiet:true,otherConversation:true,allMessagesRemainFresh:true}
}
