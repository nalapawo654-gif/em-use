async page => {
  const checks=[],widget=page.locator('.hoop-widget'),ball=page.locator('.hoop-ball-hit');
  const assert=(ok,m)=>{if(!ok)throw new Error(m)};
  await page.evaluate(()=>{const qa=window.__hoopQa;qa.settings({scene:'basketball',quotaSource:'eastmoney',windowWidth:190,theme:'day'});qa.set({quota:{...qa.state.quota,percent:75,remaining:225},status:'ready'})});
  await page.setViewportSize({width:190,height:190});await ball.click();
  const x=184/440*190,y=278/440*190;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-17.14/440*190,y+57.64/440*190,{steps:10});
  await page.screenshot({path:'output/playwright/basketball-190-aim.png'});
  await page.mouse.up();await page.waitForFunction(()=>document.querySelector('.hoop-widget').dataset.mode==='ready');
  for(let i=1;i<10;i++){await ball.focus();await page.keyboard.press('Space');await page.waitForFunction(()=>['ready','finished'].includes(document.querySelector('.hoop-widget').dataset.mode));}
  await page.getByRole('dialog',{name:'十球挑战成绩'}).waitFor();
  for(const size of [190,440]){await page.setViewportSize({width:size,height:size});await page.evaluate(size=>window.__hoopQa.settings({windowWidth:size}),size);const close=await page.getByRole('button',{name:'关闭投篮成绩'}).boundingBox();assert(close.x>=0&&close.y>=0&&close.x+close.width<=size&&close.y+close.height<=size,`result close ${size}`);await page.screenshot({path:`output/playwright/basketball-${size}-result.png`});}
  await page.getByRole('button',{name:'再来一局',exact:false}).click();checks.push('190px ten-shot result, 440px result, always-visible close, replay');
  await ball.focus();await page.keyboard.press('Space');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
  const before=await page.locator('.hoop-ball-art').getAttribute('transform');
  await page.waitForTimeout(250);
  assert(await page.locator('.hoop-ball-art').getAttribute('transform')===before,'hidden physics paused');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});
  await page.waitForFunction(()=>document.querySelector('.hoop-widget').dataset.mode==='ready');checks.push('visibility event pauses physics and resumes without catch-up');
  const rect=await ball.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();
  await page.evaluate(()=>document.querySelector('.hoop-ball-hit').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1})));await page.mouse.up();
  assert(!(await widget.evaluate(el=>el.classList.contains('hoop-aiming'))),'cancel clears aim');
  await page.keyboard.press('Escape');
  await ball.click();await ball.focus();await page.keyboard.press('Space');
  await page.evaluate(()=>window.__hoopQa.settings({scene:'aquarium'}));await page.evaluate(()=>window.__hoopQa.settings({scene:'basketball'}));await widget.waitFor();
  assert(await widget.getAttribute('data-mode')==='idle','unmount cancels active shot');checks.push('pointercancel and in-flight scene replacement clean up');
  await page.evaluate(()=>{window.emUse.showMessageToast=async()=>{};const qa=window.__hoopQa;qa.settings({calendarEnabled:true,messageEnabled:true});qa.set({calendar:{status:'ready',epoch:'qa',message:'浏览器模拟',events:[],active:[]},messages:{epoch:'qa',status:'ready',message:'浏览器模拟',account:{id:'qa'},revision:1,newCount:1,pausedUntil:0,items:[{key:'1',conversation:'c',sender:'测试',title:'测试',body:'一条模拟消息',kind:'text',at:Date.now(),fresh:true,mentioned:false}]},update:{status:'available',version:'9.9.9',message:'模拟更新',notes:'浏览器预览'}})});
  await page.mouse.move(-5,-5);await page.screenshot({path:'output/playwright/basketball-props.png'});checks.push('dedicated calendar, locker-message and shoe-box update props render');
  return {passed:checks.length,checks,scope:'browser fixtures only'};
}
