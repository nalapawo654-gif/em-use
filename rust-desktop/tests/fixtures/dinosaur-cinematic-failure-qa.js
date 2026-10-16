async(page)=>{
 await page.route('**/assets/evolution/v3/dinosaur-transformation.png',r=>r.abort())
 try{
  await page.reload();const f=page.frames()[1];await f.waitForFunction(()=>window.__evolutionQa)
  await page.locator('#pet').evaluate(e=>{e.style.width='440px';e.style.height='440px'})
  await f.evaluate(()=>window.__evolutionQa.settings({scene:'dinosaur',quotaSource:'eastmoney',evolutionMotion:'off'}))
  await f.locator('.dinosaur-ceremony-error').waitFor()
  await f.evaluate(()=>window.__evolutionQa.settings({quotaSource:'codex',evolutionMotion:'full'}))
  await f.waitForFunction(()=>document.querySelector('.evolution-surface')?.dataset.phase==='unfold')
  const fallback=await f.evaluate(()=>({error:document.querySelector('.dinosaur-ceremony-error')?.textContent,animation:getComputedStyle(document.querySelector('.dinosaur-sprite')).animationName,custom:!!document.querySelector('.is-transforming')}))
  await page.unroute('**/assets/evolution/v3/dinosaur-transformation.png')
  await f.locator('.dinosaur-ceremony-error').getByRole('button',{name:'重试'}).click()
  await f.locator('.dinosaur-ceremony-error').waitFor({state:'hidden'})
  if(fallback.custom||fallback.animation!=='evolution-body-unfold')throw new Error('Failed to fall back to simple transition')
  return {fallback,retryCleared:true}
 }finally{await page.unroute('**/assets/evolution/v3/dinosaur-transformation.png')}
}
