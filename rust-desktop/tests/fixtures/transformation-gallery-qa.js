async(page)=>{
 const results=[]
 for(const scene of ['fox','piranha','luckycat','buddy','feidudu','beaver','hamster','cultivation','battery','aquarium','skadi','potato']){
  await page.goto('http://127.0.0.1:5174/tests/fixtures/transformation-preview.html?gallery&scene='+scene);await page.waitForFunction(()=>document.body.dataset.ready==='true')
  const result=await page.evaluate(()=>({summary:document.querySelector('#summary').textContent,errors:[...document.querySelectorAll('[data-error]')].map(e=>e.dataset.error),frames:[...document.querySelectorAll('.gallery-row canvas')].length}))
  if(result.errors.length)throw Error(JSON.stringify(result));await page.screenshot({path:`output/playwright/transformation-gallery-${scene}.png`,fullPage:true});results.push({scene,...result})
 }return results
}
