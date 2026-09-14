async page => {
  const scenes=['aquarium','buddy','beaver','hamster','cultivation','battery','feidudu','fox','luckycat','dinosaur','skadi'], results=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const scene of scenes){
    await page.setViewportSize({width:440,height:440});await page.goto(`http://127.0.0.1:5187/tests/fixtures/desktop.html?scene=${scene}&update=available&fresh=1&motion=off&random=off`);await page.locator('.update-letter-button').waitFor();await page.waitForLoadState('networkidle');await page.locator('.update-letter-button').click();
    for(const width of [440,300,190,180])for(const theme of ['day','night']){
      await page.setViewportSize({width,height:width});await page.evaluate(async({width,theme})=>window.emUse.settings({windowWidth:width,theme}),{width,theme});
      const checks=await page.locator('.update-letter button').evaluateAll(bs=>bs.filter(b=>getComputedStyle(b).display!=='none').map(b=>{const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{text:b.textContent,inside:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hit:b===hit||b.contains(hit)}}));
      if(checks.length!==(width<=220?4:3)||checks.some(c=>!c.inside||!c.hit))throw Error(JSON.stringify({scene,width,theme,checks}));
      const overflow=await page.locator('.update-letter').evaluate(e=>e.scrollWidth>e.clientWidth+1);
      if(overflow)throw Error(`${scene} ${width} ${theme}: letter overflow`);
      if(width===180||width===440&&theme==='night')await page.screenshot({path:`rust-desktop/output/playwright/update-${scene}-${width}-${theme}.png`,omitBackground:true,animations:'disabled'});
      results.push({scene,width,theme,buttonsReachable:true});
    }
  }
  if(errors.length)throw Error(JSON.stringify(errors));return {errors,count:results.length,results};
}
