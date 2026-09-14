async page => {
 const scenes=['aquarium','buddy','beaver','hamster','cultivation','battery','feidudu','fox','luckycat','dinosaur','skadi'], results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const scene of scenes){
  await page.setViewportSize({width:440,height:440});await page.goto(`http://127.0.0.1:5187/tests/fixtures/desktop.html?scene=${scene}&update=available&fresh=1&motion=off&random=off`);await page.locator('.update-letter-button').waitFor();
  if(await page.locator('body').getAttribute('data-update-installs'))throw Error(scene+': auto install');
  await page.locator('.update-letter-button').click();await page.getByRole('button',{name:'更新并重启',exact:true}).click();
  await page.getByRole('button',{name:'更新进行中',exact:true}).waitFor();
  if(!await page.locator('.update-primary').isDisabled()||await page.locator('progress').getAttribute('value')!=='42')throw Error(scene+': progress or duplicate guard');
  await page.locator('.update-primary').evaluate(b=>b.click());
  if(await page.locator('body').getAttribute('data-update-installs')!=='1')throw Error(scene+': duplicate install');
  await page.keyboard.press('Escape');await page.locator('.update-letter-button').waitFor();
  if(!await page.locator('.update-letter-button').textContent().then(s=>s.includes('42%')))throw Error(scene+': collapsed transfer');
  await page.locator('.update-letter-button').click();
  await page.evaluate(()=>window.__setUpdate({status:'error',version:'0.5.0',message:'校验失败，请重新检查'}));
  await page.getByRole('button',{name:'重新检查',exact:true}).click();await page.getByRole('button',{name:'更新并重启',exact:true}).waitFor();
  if(await page.locator('body').getAttribute('data-update-checks')!=='1')throw Error(scene+': retry bridge');
  await page.getByRole('button',{name:'稍后',exact:true}).click();
  await page.mouse.move(600,600);await page.locator('.update-letter-button').evaluate(b=>b.blur());
  await page.evaluate(()=>window.__setUpdate({status:'available',version:'0.5.0',message:'same version'}));
  if(await page.locator('.update-letter-button').isVisible())throw Error(scene+': duplicate reminder');
  await page.evaluate(()=>window.__setUpdate({status:'available',version:'0.6.0',message:'new version'}));await page.locator('.update-letter-button').waitFor();
  const header=scene==='aquarium'?'.widget-header .mini-play-button':`.${scene}-header button`;
  await page.mouse.move(220,220);await page.locator(header).first().click();
  if(await page.locator('.update-letter-button').isVisible())throw Error(scene+': panel collision');
  await page.keyboard.press('Escape');await page.locator('.update-letter-button').waitFor();
  results.push({scene,explicitInstall:true,singleInstall:true,progress:true,retry:true,sameVersionQuiet:true,newVersionVisible:true,panelPriority:true});
 }
 // A fresh renderer reads the persisted dismissal across scenes (native persistence separately implemented in Rust).
 await page.goto('http://127.0.0.1:5187/tests/fixtures/desktop.html?scene=fox&update=available&motion=off');await page.waitForLoadState('networkidle');await page.mouse.move(600,600);
 if(await page.locator('.update-letter-button').isVisible())throw Error('fixture dismissal not restored');
 // The dedicated settings entry opens the Updates tab without another click.
 await page.setViewportSize({width:880,height:680});await page.goto('http://127.0.0.1:5187/tests/fixtures/desktop.html?view=settings&tab=updates&update=available&width=800');await page.getByRole('button',{name:'检查更新',exact:true}).waitFor();
 await page.goto('http://127.0.0.1:5187/tests/fixtures/desktop.html?view=settings&update=available&width=800');await page.waitForLoadState('networkidle');await page.evaluate(()=>window.dispatchEvent(new CustomEvent('open-updates')));await page.getByRole('button',{name:'检查更新',exact:true}).waitFor();
 if(errors.length)throw Error(JSON.stringify(errors));return{errors,results,fixturePersistence:true,settingsRouting:true};
}
