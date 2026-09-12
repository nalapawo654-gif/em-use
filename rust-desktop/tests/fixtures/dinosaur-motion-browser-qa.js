async page => {
  const check=(ok,label)=>{if(!ok)throw Error(label)};let checks=0;
  await page.reload();await page.locator('.dinosaur-visual[data-rig-loaded=true]').waitFor();
  await page.waitForFunction(()=>document.querySelector('.dinosaur-character .dinosaur-visual')?.getAttribute('data-motion'),{},{timeout:8500});checks++;
  check(await page.locator('.dinosaur-hud button').isVisible(),'automatic motion has exit');checks++;
  await page.locator('.dinosaur-widget').click({position:{x:4,y:4}});await page.keyboard.press('Escape');
  check(await page.locator('.dinosaur-character .dinosaur-visual').getAttribute('data-motion')===null,'Escape cancels autonomous animation');checks++;
  const actions=[['长翅膀飞一圈','fly'],['偷偷刷手机','phone'],['困困打哈欠','yawn'],['左右看看','look'],['举爪伸懒腰','stretch']];
  for(const [label,id] of actions){
    await page.locator('.dinosaur-widget').hover();await page.getByRole('button',{name:'小恐龙更多玩法',exact:true}).click();
    await page.getByRole('dialog').getByRole('button').filter({hasText:label}).click();
    check(await page.locator('.dinosaur-character .dinosaur-visual').getAttribute('data-motion')===id,'manual '+id);checks++;
    const before=await page.locator('.dinosaur-character canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(1500);
    const after=await page.locator('.dinosaur-character canvas').evaluate(c=>c.toDataURL());check(before!==after,'actual pixels move '+id);checks++;
    await page.screenshot({path:'output/playwright/dinosaur-daily-'+id+'.png'});
    check(await page.evaluate(()=>window.dinosaurQA.state.quota.percent)===100,'quota unchanged '+id);checks++;
    await page.keyboard.press('Escape');
  }
  await page.locator('.dinosaur-widget').hover();await page.getByRole('button',{name:'小恐龙更多玩法',exact:true}).click();await page.getByRole('dialog').getByRole('button').filter({hasText:'长翅膀飞一圈'}).click();
  await page.waitForTimeout(3500);
  const hit=await page.locator('.dinosaur-body-hit').evaluate(el=>getComputedStyle(el).transform);check(hit!=='none','flight hit target follows sprite');checks++;
  await page.getByRole('button',{name:'小恐龙换装',exact:true}).click();check(await page.locator('.dinosaur-character .dinosaur-visual').getAttribute('data-motion')===null,'panel interrupts flight');checks++;
  await page.keyboard.press('Escape');
  for(const width of [180,190,300]){
    await page.setViewportSize({width,height:width});await page.locator('.dinosaur-widget').hover();await page.getByRole('button',{name:'小恐龙更多玩法',exact:true}).click();await page.getByRole('dialog').getByRole('button').filter({hasText:'偷偷刷手机'}).click();
    const b=await page.getByRole('button',{name:'结束小恐龙互动',exact:true}).boundingBox();check(b&&b.y+b.height<=width,'motion exit fits '+width);checks++;
    await page.screenshot({path:'output/playwright/dinosaur-daily-mini-'+width+'.png'});await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:440,height:440});await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(7500);
  check(await page.locator('.dinosaur-character .dinosaur-visual').getAttribute('data-motion')===null,'reduced motion disables automatic scheduling');checks++;
  await page.locator('.dinosaur-widget').hover();await page.getByRole('button',{name:'小恐龙更多玩法',exact:true}).click();await page.getByRole('dialog').getByRole('button').filter({hasText:'偷偷刷手机'}).click();
  const still=await page.locator('.dinosaur-character canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(300);check(still===await page.locator('.dinosaur-character canvas').evaluate(c=>c.toDataURL()),'reduced mode static result');checks++;
  await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{window.dinosaurQA.setPercent(0)});await page.waitForTimeout(7500);check(await page.locator('.dinosaur-character .dinosaur-visual').getAttribute('data-motion')===null,'zero quota stays resting');checks++;
  return {checks};
}
