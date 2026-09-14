async page => {
 const scenes=['aquarium','buddy','beaver','hamster','cultivation','battery','feidudu','fox','luckycat','dinosaur','skadi'], results=[];
 await page.emulateMedia({reducedMotion:'no-preference'});
 for(const scene of scenes){
  await page.setViewportSize({width:440,height:440});await page.goto(`http://127.0.0.1:5187/tests/fixtures/desktop.html?scene=${scene}&update=available&fresh=1&motion=on&random=off`);await page.locator('.update-letter-button').waitFor();
  const motion=await page.evaluate(async()=>{const e=document.querySelector('.update-parcel .parcel-move'),a=e.getAnimations()[0];if(!a)return null;await a.ready;a.pause();a.currentTime=0;const before={transform:getComputedStyle(e).transform,opacity:getComputedStyle(e).opacity};a.currentTime=650;const after={transform:getComputedStyle(e).transform,opacity:getComputedStyle(e).opacity};return{name:a.animationName,changed:JSON.stringify(before)!==JSON.stringify(after)}});
  if(!motion?.changed)throw Error(scene+': static greeting');
  await page.evaluate(()=>window.emUse.settings({reducedMotion:true}));
  if(await page.locator('.parcel-move').first().evaluate(e=>getComputedStyle(e).animationName)!=='none')throw Error(scene+': gentle ignored');
  await page.evaluate(()=>window.emUse.settings({reducedMotion:false}));await page.emulateMedia({reducedMotion:'reduce'});
  if(await page.locator('.parcel-move').first().evaluate(e=>getComputedStyle(e).animationName)!=='none')throw Error(scene+': system gentle ignored');
  await page.emulateMedia({reducedMotion:'no-preference'});results.push({scene,...motion,gentle:true,systemGentle:true});
 }
 // The smallest letter routes full notes to the settings window, not a clipped text area.
 await page.setViewportSize({width:180,height:180});await page.evaluate(()=>window.emUse.settings({windowWidth:180,reducedMotion:true}));await page.locator('.update-letter-button').click();
 const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'在设置中查看更新说明'}).click();const popup=await popupPromise;await popup.getByRole('button',{name:'检查更新',exact:true}).waitFor();await popup.close();
 return {results,miniNotesRouting:true};
}
