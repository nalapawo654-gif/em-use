// Pass to playwright-cli run-code. Development bridge only; no real update traffic.
async page => {
  const scenes=['aquarium','buddy','beaver','hamster','cultivation','battery','feidudu','fox','luckycat','dinosaur','skadi'];
  const results=[], errors=[];page.on('pageerror',e=>errors.push(e.message));
  for (const scene of scenes) {
    await page.setViewportSize({width:440,height:440});
    await page.goto(`http://127.0.0.1:5187/tests/fixtures/desktop.html?scene=${scene}&update=available&fresh=1&motion=off&random=off`);
    await page.locator('.update-letter-button').waitFor();await page.waitForLoadState('networkidle');
    await page.mouse.move(600,600);
    await page.screenshot({path:`rust-desktop/output/playwright/update-${scene}-badge.png`,omitBackground:true,animations:'disabled'});
    const quota=await page.evaluate(async()=>JSON.stringify((await window.emUse.getState()).quota));
    await page.locator('.update-letter-button').click();
    const dialog=page.getByRole('dialog',{name:/版本更新/});await dialog.waitFor();
    const blocked=await page.evaluate(()=>[...document.querySelector('.pet-update-notice').parentElement.children].filter(e=>!e.classList.contains('pet-update-notice')).every(e=>e.inert));
    if(!blocked)throw Error(scene+': siblings not inert');
    const outside=await dialog.locator('button').evaluateAll(bs=>bs.filter(b=>{const r=b.getBoundingClientRect();return r.x<0||r.y<0||r.right>innerWidth||r.bottom>innerHeight}));
    if(outside.length)throw Error(scene+': unreachable buttons');
    await page.screenshot({path:`rust-desktop/output/playwright/update-${scene}-letter.png`,omitBackground:true,animations:'disabled'});
    await page.keyboard.press('Escape');
    if(await page.locator('.update-letter').count())throw Error(scene+': Esc failed');
    await page.mouse.move(600,600);await page.locator('.update-letter-button').evaluate(b=>b.blur());
    if(await page.locator('.update-letter-button').isVisible())throw Error(scene+': snooze visible while idle');
    await page.mouse.move(220,220);await page.locator('.update-letter-button').waitFor();
    const after=await page.evaluate(async()=>window.emUse.getState());
    if(after.dismissedUpdateVersion!=='0.5.0'||JSON.stringify(after.quota)!==quota)throw Error(scene+': dismissal or quota changed');
    results.push({scene,dialog:true,escape:true,snooze:true,quotaUnchanged:true});
  }
  if(errors.length)throw Error(JSON.stringify(errors));return{errors,results};
}
