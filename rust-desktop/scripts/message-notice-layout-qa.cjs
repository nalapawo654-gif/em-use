// Playwright CLI run-code; fixture emulates the separate native toast using a neighbouring frame.
async page => {
 const scenes=['aquarium','buddy','beaver','hamster','cultivation','battery','feidudu','fox','luckycat','dinosaur','skadi'], results=[], errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const scene of scenes)for(const width of [440,300,190,180])for(const theme of ['day','night']){
  await page.setViewportSize({width:width+310,height:width});
  await page.bringToFront();await page.goto(`http://127.0.0.1:5188/tests/fixtures/desktop.html?scene=${scene}&width=${width}&canvas=wide&messages=1&theme=${theme}&percent=91&motion=off&random=off`,{waitUntil:'domcontentloaded'});
  const toast=page.frameLocator('iframe[name="message-toast"]');await toast.locator('.message-bubble').waitFor();await toast.locator('.message-bubble-content').hover();
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-loaded]')].every(e=>e.getAttribute('data-loaded')==='true'));
  if(scene==='skadi')await page.locator('.skadi-figure[data-ready="true"]').waitFor();
  const box=await page.locator('.message-launcher').boundingBox();if(!box||box.x<0||box.y<0||box.x+box.width>width||box.y+box.height>width)throw Error(`${scene}/${width} prop clipped`);
  const outside=await page.locator('iframe[name="message-toast"]').boundingBox();if(outside.x<width)throw Error('Toast covers pet');
  if(theme==='day')await page.screenshot({path:`rust-desktop/output/playwright/message-fixed-${scene}-${width}.png`,animations:'disabled'});
  await toast.getByRole('button',{name:'收起消息气泡',exact:true}).click();
  if(await page.locator('.message-count').textContent()!=='1')throw Error('Collapse cleared count');
  await page.locator('.message-launcher').hover();
  const overlaps=await page.evaluate(()=>{
   const prop=document.querySelector('.message-launcher').getBoundingClientRect();
   const selectors='[class$="-speech"],.quota-display,.quota-overlay,.buddy-sign,.beaver-sign,.hamster-quota,.cultivation-quota,.battery-quota,[class$="-quota-wrap"],[class*="-header"] button,[class*="-tools"] button,.hover-tools button';
   return [...document.querySelectorAll(selectors)].filter(e=>e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})).filter(e=>{const r=e.getBoundingClientRect();return Math.min(r.right,prop.right)-Math.max(r.left,prop.left)>1&&Math.min(r.bottom,prop.bottom)-Math.max(r.top,prop.top)>1}).map(e=>({class:e.className,text:e.textContent.slice(0,30)}))
  });// Collect all collisions so every character is audited in the same pass.
  const opened=page.waitForEvent('popup');await page.locator('.message-launcher').click();const card=await opened;
  await card.locator('.message-detail').waitFor();await card.getByRole('button',{name:'打开咚咚',exact:true}).click();
  if(await page.evaluate(()=>document.body.dataset.dongdongOpened)!=='1')throw Error('Open DongDong bridge not invoked');
  await card.close();await page.waitForFunction(()=>!document.querySelector('.message-open'));
  results.push({scene,width,theme,outside:true,propClear:!overlaps.length,overlaps,openDongdong:true});
 }
 const conflicts=results.filter(r=>!r.propClear);if(conflicts.length)throw Error(JSON.stringify(conflicts));
 if(errors.length)throw Error(JSON.stringify(errors));return {count:results.length,results,errors};
}
