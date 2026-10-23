// Run after codex-quota-browser-qa.js in the same Playwright CLI session.
async page => {
  const scenes = ['aquarium','buddy','beaver','hamster','cultivation','battery','feidudu','fox','luckycat','dinosaur','skadi','piranha','potato'];
  await page.evaluate(() => { const qa=window.__quotaQa; qa.state.codex.buckets=[{id:'codex',name:'Codex',plan:'pro',windows:[]}]; qa.state.codex.account={id:'test',name:'演示账户',plan:'pro'}; });
  const failures = [];
  let checks = 0;
  for (const size of [440,300,190,180]) {
    await page.setViewportSize({width:size,height:size});
    for (const status of ['ready','stale','unavailable']) {
      for (const scene of scenes) {
        await page.evaluate(async ({size,status,scene}) => {
          const qa=window.__quotaQa, stamp=Date.now();
          qa.state.codex.buckets[0].windows=[{id:'primary',remainingPercent:status==='unavailable'?null:100,windowDurationMins:300,resetsAt:stamp/1000+7200},{id:'secondary',remainingPercent:status==='unavailable'?null:0,windowDurationMins:10080,resetsAt:stamp/1000+172800}];
          qa.state.codex.status=status; qa.state.codex.receivedAt=stamp;
          qa.settings({scene,windowWidth:size,quotaSource:'codex',theme:status==='stale'?'night':'day'});
          await new Promise(requestAnimationFrame);
        }, {size,status,scene});
        const failuresHere = await page.locator('.codex-readout').evaluate(el => {
          const host=el.parentElement.getBoundingClientRect();
          const errors=[];
          for (const child of el.querySelectorAll('.codex-readout-label,.codex-readout-value,.codex-readout-heading')) {
            const r=child.getBoundingClientRect();
            if (r.width===0 || r.height===0 || r.left< -1 || r.top< -1 || r.right>innerWidth+1 || r.bottom>innerHeight+1 || r.left<host.left-2 || r.right>host.right+2 || r.top<host.top-2 || r.bottom>host.bottom+2) errors.push(child.textContent);
          }
          return errors;
        });
        if(failuresHere.length) failures.push({scene,size,status,text:failuresHere});
        const text=await page.locator('.codex-readout').innerText();
        if (status==='unavailable' ? !text.includes('—') || text.includes('%') : !text.includes('100%') || !text.includes('0%') || (status==='stale'&&!text.includes('待更新'))) failures.push({scene,size,status,text});
        if (size===440 && status==='ready' || size===190 && status==='stale') await page.screenshot({path:`output/playwright/codex-dual-${scene}-${size}-${status}.png`});
        checks++;
      }
    }
  }
  return {checks,failures};
}
