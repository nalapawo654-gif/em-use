async (page) => {
  const defaults = await page.evaluate(async () => (await import('/src/shared/types.ts')).DEFAULT_SETTINGS);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ defaults }) => {
    const stamp = Date.now();
    const state = { settings: { ...defaults, quotaSource: 'codex', codexEnabled: true, reducedMotion: true, calendarEnabled: false, messageEnabled: false }, status: 'ready', message: 'AI 云平台测试快照', syncing: false, quota: { percent: 80, remaining: 240, limit: 300, used: 60, day: '2026-10-15', estimatedAt: new Date(stamp).toISOString(), serverAt: new Date(stamp).toISOString(), receivedAt: stamp, exceeded: false }, version: 'QA', loginMode: 'manual', account: { id: 'cloud-fixture' }, persistentLogin: false, loginOpen: false,
      codex: { status: 'ready', message: '演示数据 · Codex 测试快照', syncing: false, account: { id: 'codex-fixture', name: '演示账户', plan: '演示套餐' }, receivedAt: stamp, buckets: [{ id: 'codex', name: 'Codex', plan: null, windows: [{ id: 'primary', remainingPercent: 62, windowDurationMins: 300, resetsAt: Math.floor(stamp/1000)+7200 }, { id: 'secondary', remainingPercent: 28, windowDurationMins: 10080, resetsAt: Math.floor(stamp/1000)+172800 }] }] } };
    const listeners = new Set();
    const emit = () => { for (const cb of listeners) cb(structuredClone(state)); };
    window.__quotaQa = { set: patch => { Object.assign(state, patch); emit(); }, settings: patch => { Object.assign(state.settings, patch); emit(); }, state };
    const noop = async () => {};
    window.emUse = { getState: async () => structuredClone(state), onState: cb => { listeners.add(cb); return () => listeners.delete(cb); }, settings: async patch => { Object.assign(state.settings, patch); emit(); }, refresh: noop, refreshCodex: noop, login: noop, logout: noop, openPortal: noop, openSettings: noop, beginGesture: async () => 1, moveGesture: noop, endGesture: noop, hide: noop, quit: noop, screenshot: async () => null, openReleases: noop };
  }, {defaults});
  const results = [];
  const scenes = ['aquarium','buddy','beaver','hamster','cultivation','battery','feidudu','fox','luckycat','dinosaur','skadi','piranha','potato'];
  await page.setViewportSize({width:440,height:440});
  await page.goto('http://127.0.0.1:5174/?view=widget');
  for (const scene of scenes) {
    await page.evaluate(scene => window.__quotaQa.settings({scene,quotaSource:'codex'}), scene);
    const widget = page.locator(scene === 'aquarium' ? '.widget' : `.${scene}-widget`);
    await widget.waitFor();
    const quota = page.locator(scene === 'aquarium' ? '.quota-overlay' : scene === 'buddy' ? '.buddy-sign-copy' : `.${scene}-quota`);
    if (!(await quota.innerText()).includes('28%') || !(await quota.innerText()).includes('62%') || !(await quota.innerText()).includes('Codex')) throw new Error(scene + ': missing selected Codex quota');
    await widget.hover();
    const entry = scene === 'aquarium' ? '.status-pill' : scene === 'buddy' ? '.buddy-status' : scene === 'beaver' ? '.beaver-footer button:first-child' : `button.${scene}-quota`;
    await page.locator(entry).click();
    const details = page.locator('.shared-quota-details');
    await details.waitFor();
    const text = await details.innerText();
    if (!text.includes('62%') || !text.includes('28%') || text.includes('¥') || text.includes('00:00')) throw new Error(scene + ': incorrect Codex details');
    await details.getByRole('combobox', {name:'额度来源',exact:true}).selectOption('eastmoney');
    await page.waitForFunction(() => window.__quotaQa.state.settings.quotaSource === 'eastmoney');
    if (!(await details.innerText()).includes('¥240.00') || !(await quota.innerText()).includes('80')) throw new Error(scene + ': cloud source did not recover');
    await details.getByRole('combobox', {name:'额度来源',exact:true}).selectOption('codex');
    if (!(await quota.innerText()).includes('28')) throw new Error(scene + ': switching back lost Codex');
    results.push(scene + ': source switch, independent values, details');
    // Close via the visible parent panel button before unmounting.
    await page.locator(scene === 'aquarium' ? '.detail-popover > button' : scene === 'buddy' ? '.buddy-details header button' : `.${scene}-panel header button`).click();
  }
  for (const size of [440,300,190]) {
    await page.setViewportSize({width:size,height:size});
    for (const scene of scenes) {
      await page.evaluate(({scene,size}) => window.__quotaQa.settings({scene,windowWidth:size}), {scene,size});
      const widget = page.locator(scene === 'aquarium' ? '.widget' : `.${scene}-widget`);
      const readout = widget.locator('.codex-readout');
      if (!(await readout.innerText()).includes('62%') || !(await readout.innerText()).includes('28%')) throw new Error(`${scene} ${size}: both windows must be visible`);
      const boundsCheck = await readout.evaluate(el => {
        const host = el.parentElement.getBoundingClientRect();
        return [...el.querySelectorAll('.codex-readout-label,.codex-readout-value,.codex-readout-heading')].every(child => {
          const r = child.getBoundingClientRect();
          return r.x >= -1 && r.y >= -1 && r.right <= innerWidth+1 && r.bottom <= innerHeight+1 && r.left >= host.left-2 && r.right <= host.right+2 && r.top >= host.top-2 && r.bottom <= host.bottom+2;
        });
      });
      if (!boundsCheck) throw new Error(`${scene} ${size}: readout exceeds its container`);
      await widget.hover();
      const entry = scene === 'aquarium' ? '.status-pill' : scene === 'buddy' ? '.buddy-status' : scene === 'beaver' ? '.beaver-footer button:first-child' : `button.${scene}-quota`;
      await page.locator(entry).click();
      const details = page.locator('.shared-quota-details');
      await details.getByRole('combobox').selectOption('eastmoney');
      await details.getByRole('combobox').selectOption('codex');
      const close = page.locator(scene === 'aquarium' ? '.detail-popover > button' : scene === 'buddy' ? '.buddy-details header button' : `.${scene}-panel header button`);
      const bounds = await close.boundingBox();
      if (!bounds || bounds.x < -1 || bounds.y < -1 || bounds.x+bounds.width > size+1 || bounds.y+bounds.height > size+1) throw new Error(`${scene} ${size}: close outside window`);
      if (['potato','aquarium','buddy','beaver'].includes(scene)) await page.screenshot({path:`output/playwright/codex-dual-${scene}-${size}.png`});
      await close.click();
      if (size === 190) await page.screenshot({path:`output/playwright/codex-dual-${scene}-190-main.png`});
      results.push(`${scene} ${size}: source selector and close reachable`);
    }
  }
  // Weekly-only responses must not fabricate a five-hour window, even when
  // the weekly window occupies the protocol's primary slot.
  await page.evaluate(() => { const qa = window.__quotaQa; qa.state.codex.account.plan = 'pro'; qa.state.codex.buckets[0].windows = [{...qa.state.codex.buckets[0].windows[1], id:'primary'}]; qa.set({codex:qa.state.codex}); });
  for (const scene of scenes) {
    await page.evaluate(scene => window.__quotaQa.settings({scene}), scene);
    const readout = page.locator('.codex-readout');
    await readout.waitFor();
    const text = await readout.innerText();
    if ((await readout.locator('.codex-readout-window').count()) !== 1 || !text.includes('周') || !text.includes('28%') || text.includes('5小时')) throw new Error(scene + ': weekly-only readout is incorrect');
  }
  results.push('all 13 pets: weekly-only Pro response, no invented five-hour window');
  if (errors.length) throw new Error(errors.join('\n'));
  await page.evaluate(() => { const qa = window.__quotaQa; qa.set({codex: {...qa.state.codex, status:'stale', message:'上次同步 · 网络暂不可用'}}); });
  if (!(await page.locator('.potato-quota').innerText()).includes('28') || !(await page.locator('.potato-quota').innerText()).includes('待更新')) throw new Error('stale value lost or unlabeled');
  await page.evaluate(() => { const qa = window.__quotaQa; qa.set({codex: {...qa.state.codex, status:'signed-out', account:null, buckets:[], receivedAt:null}}); });
  if (!(await page.locator('.potato-quota').innerText()).includes('—')) throw new Error('signed-out must be unknown');
  await page.evaluate(() => window.__quotaQa.settings({quotaSource:'eastmoney'}));
  if (!(await page.locator('.potato-quota').innerText()).includes('80')) throw new Error('Codex signout corrupted cloud state');
  results.push('stale, signed-out, and independent cloud state');
  await page.evaluate(() => window.__quotaQa.settings({scene:'aquarium'}));
  await page.locator('.widget').hover();
  await page.locator('.status-pill').click();
  await page.locator('.shared-quota-details select').focus();
  await page.keyboard.press('Escape');
  if (await page.locator('.shared-quota-details').count()) throw new Error('aquarium details Esc did not close');
  results.push('aquarium details Escape closes');
  return {passed:results.length, checks:results};
}
