async(page)=>{
 const url='http://127.0.0.1:5174/tests/fixtures/evolution-harness.html',pattern='**/assets/evolution/v3/fox-transformation.png'
 await page.unroute(pattern);await page.emulateMedia({reducedMotion:'no-preference'});
 await page.route(pattern,r=>r.abort());await page.goto(url);let f=page.frames()[1];await f.waitForFunction(()=>window.__evolutionQa&&document.querySelector('.evolution-surface'));await page.waitForTimeout(150)
 await f.evaluate(()=>window.__evolutionQa.settings({scene:'fox',quotaSource:'eastmoney',evolutionMotion:'off'}));await f.locator('.awakening-load-error').waitFor()
 await f.evaluate(()=>window.__evolutionQa.settings({quotaSource:'codex',evolutionMotion:'full'}));await f.waitForFunction(()=>document.querySelector('.evolution-surface')?.dataset.phase==='unfold')
 const fallback=await f.evaluate(()=>({error:document.querySelector('.awakening-load-error')?.textContent,cinematic:!!document.querySelector('[data-transformation-scene]'),animation:getComputedStyle(document.querySelector('.fox-motion')).animationName}))
 await page.unroute(pattern);await f.locator('.awakening-load-error').getByRole('button',{name:'重试'}).click();await f.locator('.awakening-load-error').waitFor({state:'hidden'});await page.waitForTimeout(1700)
 if(fallback.cinematic||fallback.animation!=='evolution-body-unfold')throw Error(JSON.stringify(fallback))
 const rapid=await f.evaluate(async()=>{const q=window.__evolutionQa;q.settings({foxSkin:'jade'});await new Promise(r=>setTimeout(r,70));q.settings({foxSkin:'classic'});await new Promise(r=>setTimeout(r,70));q.settings({foxSkin:'sepia'});await new Promise(r=>setTimeout(r,1950));return {skin:document.querySelector('.fox-motion')?.dataset.awakeningSkin,phase:document.querySelector('.evolution-surface')?.dataset.phase,cinematic:!!document.querySelector('[data-transformation-scene]')}})
 if(rapid.skin!=='fox/sepia'||rapid.phase!=='idle'||rapid.cinematic)throw Error(JSON.stringify(rapid))
 await f.evaluate(()=>window.__evolutionQa.settings({foxSkin:'jade'}));await f.waitForFunction(()=>!!document.querySelector('[data-transformation-scene]'))
 await f.evaluate(()=>window.__evolutionQa.settings({evolutionMotion:'off'}));await page.waitForTimeout(100)
 const cancelled=await f.evaluate(()=>!document.querySelector('[data-transformation-scene]')&&document.querySelector('.evolution-surface')?.dataset.phase==='idle');if(!cancelled)throw Error('Off failed to cancel')
 await page.emulateMedia({reducedMotion:'reduce'});await f.evaluate(()=>{window.__evolutionQa.settings({evolutionMotion:'full',quotaSource:'eastmoney'})});await page.waitForTimeout(300)
 const reduced=await f.evaluate(()=>({cinematic:!!document.querySelector('[data-transformation-scene]'),mode:document.querySelector('.fox-motion')?.dataset.awakeningMotion,phase:document.querySelector('.evolution-surface')?.dataset.phase}));if(reduced.cinematic||reduced.mode!=='light'||reduced.phase!=='idle')throw Error(JSON.stringify(reduced));await page.emulateMedia({reducedMotion:'no-preference'})
 // A delayed atlas holds the ceremony until decoding completes.
 await page.route(pattern,async r=>{await new Promise(resolve=>setTimeout(resolve,1200));await r.continue()});await page.goto(url);f=page.frames()[1];await f.waitForFunction(()=>window.__evolutionQa&&document.querySelector('.evolution-surface'));await page.waitForTimeout(150)
 await f.evaluate(()=>window.__evolutionQa.settings({scene:'fox',quotaSource:'codex',evolutionMotion:'full'}));await page.waitForTimeout(250)
 const cold=await f.evaluate(()=>({phase:document.querySelector('.evolution-surface')?.dataset.phase,cinematic:!!document.querySelector('[data-transformation-scene]')}));if(cold.cinematic||cold.phase!=='idle')throw Error(JSON.stringify(cold))
 await f.waitForFunction(()=>!!document.querySelector('[data-transformation-scene]'));await page.waitForTimeout(1800);await page.unroute(pattern)
 const done=await f.evaluate(()=>document.querySelector('.evolution-surface')?.dataset.phase);if(done!=='idle')throw Error('Cold load did not finish')
 return {fallback,retry:true,rapid,cancelled,reduced,cold,coldCompleted:done}
}
