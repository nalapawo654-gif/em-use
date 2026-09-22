async (page) => {
  const results = [];
  const check = (ok, name) => { if (!ok) throw new Error(name); results.push(name); };
  await page.setViewportSize({ width: 1280, height: 1000 });
  for (const [scene, count] of [['aquarium',4],['buddy',4],['beaver',6],['battery',6],['hamster',4],['cultivation',4],['fox',4],['luckycat',4],['skadi',4],['feidudu',5],['dinosaur',5],['piranha',4]]) {
    await page.goto('http://127.0.0.1:5189/?scene=' + scene);
    const selector = scene === 'aquarium' ? '.state-buttons > button' : '.' + scene + '-states > button';
    const buttons = page.locator(selector);
    await buttons.first().waitFor();
    check(await buttons.count() === count, scene + ': correct preview count');
    for (let index = 0; index < count; index++) {
      await buttons.nth(index).click();
      // Read the live bridge state after the same normalization used by preview clicks.
      await page.waitForFunction(async ({scene,index,count}) => {
        const { api } = await import('/src/bridge.ts');
        const state = await api.getState();
        if (!state.quota || Math.abs(state.quota.percent - 100 * (count-index)/count) > 0.00001) return false;
        if (scene === 'aquarium') {
          const { moodFor } = await import('/src/shared/quota.ts');
          return moodFor(state.quota.percent) === ['abundant','normal','warning','danger'][index];
        }
        const module = await import('/src/' + scene + '/play.ts');
        const stages = {
          buddy:[0,1,2,3], beaver:[0,1,2,3,4,5], battery:['full','bright','steady','tired','low','empty'],
          hamster:['full','working','low','empty'], cultivation:['full','settling','low','empty'],
          fox:['full','medium','low','empty'], luckycat:['full','medium','low','empty'], skadi:['full','medium','low','empty'],
          feidudu:['full','tea','tired','low','empty'], dinosaur:['full','tea','tired','low','empty'], piranha:['full','hungry','low','empty']
        };
        return module[scene+'Level'](state.quota.percent) === stages[scene][index];
      }, {scene,index,count});
      const selected = await buttons.nth(index).evaluate(el => el.getAttribute('aria-pressed') === 'true' || el.classList.contains('selected'));
      check(selected, scene + ': preview ' + index + ' selects corresponding form');
      if (scene === 'piranha') {
        await page.locator('.piranha-character .piranha-sprite[data-frame="'+index+'"][data-ready=true]').waitFor();
        check(true, 'piranha: rendered frame ' + index);
      }
      if (scene === 'beaver') {
        await page.locator('.beaver-widget .beaver-level-'+index).first().waitFor();
        check(true, 'beaver: rendered form ' + index);
      }
      if (scene === 'battery') {
        check((await page.locator('.battery-quota').getAttribute('class')).includes('charge-' + ['full','bright','steady','tired','low','empty'][index]), 'battery: rendered form ' + index);
      }
    }
  }
  await page.goto('http://127.0.0.1:5189/?scene=piranha');
  await page.locator('.piranha-states button').last().click();
  await page.locator('.piranha-character .piranha-sprite[data-frame="3"][data-ready=true]').waitFor();
  await page.screenshot({path:'output/playwright/uniform-quota-preview.png',fullPage:true});
  return { passed: results.length, checks: results };
}
