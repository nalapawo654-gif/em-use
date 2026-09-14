// Regression: opening the external card must not cancel a short actor action.
async page => {
 const results=[];await page.setViewportSize({width:750,height:440});
 for(const scene of ['feidudu','dinosaur','skadi']){
  const action=scene==='skadi'?'sing':'tea';
  await page.bringToFront();await page.goto(`http://127.0.0.1:5188/tests/fixtures/desktop.html?scene=${scene}&width=440&canvas=wide&messages=1&motion=off&random=off`);
  await page.locator('.character-mail-art[data-ready=true]').waitFor();
  await page.evaluate(({scene,action})=>document.querySelector(`.${scene}-widget`).__vueParentComponent.setupState.act(action),{scene,action});
  const opening=page.waitForEvent('popup');await page.locator('.message-launcher').click();const card=await opening;
  await card.locator('.message-detail').first().waitFor();
  const after=await page.locator(`.${scene}-widget`).evaluate(e=>e.__vueParentComponent.setupState.play.action);
  if(after!==action)throw Error(`${scene}: card focus cancelled ${action}: ${after}`);
  await card.close();results.push({scene,action,preserved:true});
 }
 return results;
}
