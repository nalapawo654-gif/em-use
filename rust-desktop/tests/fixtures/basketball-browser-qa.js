async page => {
  const checks = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({width:1280,height:1000});
  const widget=page.locator('.hoop-widget'), ball=page.locator('.hoop-ball-hit');
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  await page.getByRole('button',{name:'02 75% 中距离 命中 3 分 · 空心 4 分',exact:true}).click();
  assert(await widget.getAttribute('data-level')==='1','middle distance');
  await ball.click();
  assert(await widget.getAttribute('data-mode')==='ready','ball starts game');
  await page.keyboard.press('ArrowUp');
  assert((await page.locator('.hoop-instruction').innerText()).includes('力度'),'keyboard aim feedback');
  await page.keyboard.press('Escape');
  assert(await widget.getAttribute('data-mode')==='idle','Escape from focused ball');
  checks.push('ball start, keyboard aim, focused-ball Escape');
  for(let level=0;level<4;level++){
    await page.locator('.hoop-distance-cards>button').nth(level).click();
    await ball.click();
    const rect=await widget.boundingBox();
    const point=await page.evaluate(async level=>{
      const {origin,COURT}=await import('/src/basketball/game.ts');const p=origin(level),t=1.3;
      return {p,dx:-((COURT.left+COURT.right)/2-p.x)/t/7,dy:-(COURT.rimY-p.y-.5*COURT.gravity*t*t)/t/7};
    },level);
    const scale=rect.width/440,x=rect.x+point.p.x*scale,y=rect.y+point.p.y*scale;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+point.dx*scale,y+point.dy*scale,{steps:12});
    assert(await widget.evaluate(el=>el.classList.contains('hoop-aiming')),'pointer capture starts');
    if(level===3)await page.screenshot({path:'output/playwright/basketball-aim.png'});
    await page.mouse.up();
    await page.waitForFunction(()=>document.querySelector('.hoop-widget').dataset.mode==='ready');
    assert(await page.locator('.hoop-scoreboard strong').innerText()===String(level+3).padStart(2,'0'),`distance ${level} swish`);
    await page.keyboard.press('Escape');
    checks.push(`distance ${level}: real pointer drag, physical swish, automatic return`);
  }
  await page.locator('.hoop-distance-cards>button').nth(3).click();await ball.click();
  await page.locator('.hoop-distance-cards>button').nth(0).click();
  assert(await widget.getAttribute('data-level')==='3','live quota preserves round distance');
  assert((await page.locator('.hoop-quota').innerText()).includes('100%'),'quota still refreshes');
  checks.push('mid-round quota updates display without moving station');
  // The last drag left a valid far-shot angle/power. Use real keyboard inputs for all ten balls.
  for(let i=0;i<10;i++){
    await ball.focus();await page.keyboard.press('Space');
    await page.waitForFunction(()=>['ready','finished'].includes(document.querySelector('.hoop-widget').dataset.mode));
  }
  await page.getByRole('dialog',{name:'十球挑战成绩'}).waitFor();
  const result=await page.locator('.hoop-result').innerText();
  assert(result.includes('60')&&result.includes('10/10'),'ten-shot result and scores');
  await page.screenshot({path:'output/playwright/basketball-result.png'});
  await page.getByRole('button',{name:'再来一局',exact:false}).click();
  assert(await widget.getAttribute('data-level')==='0','replay takes current quota');
  assert(await page.locator('.hoop-scoreboard strong').innerText()==='00','replay clears score');
  await page.keyboard.press('Escape');
  checks.push('ten keyboard shots, 60 points, 10/10, replay resets and applies new distance');
  await page.getByRole('button',{name:'未知额度 · 练习模式'}).click();await ball.click();
  assert((await page.locator('.hoop-instruction').innerText()).includes('额度未知'),'unknown practice labeled');
  assert((await page.locator('.hoop-quota').innerText()).includes('—'),'unknown quota not zero');
  // Cancellation never spends a ball or launches a projectile.
  const r=await ball.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();
  assert(await widget.getAttribute('data-mode')==='ready','blur cancels pull');
  assert((await page.locator('.hoop-scoreboard').innerText()).includes('10'),'cancel keeps ten balls');
  await page.keyboard.press('Escape');checks.push('unknown practice and blur cancel without consuming shots');
  await widget.hover();await page.getByRole('button',{name:'投篮球衣',exact:true}).click();
  await page.getByRole('button',{name:'客场蓝 海风远投',exact:true}).click();
  assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('em-use-preview-settings')).basketballSkin)==='away','jersey stored by shared preview settings');
  assert(await page.locator('.hoop-court .hoop-player').evaluate(el=>el.classList.contains('jersey-away')),'jersey changed');
  await page.mouse.move(1250,950);assert(await page.locator('.hoop-panel').isVisible(),'panel retained off hover');
  await page.getByRole('button',{name:'关闭投篮面板'}).click();
  await page.getByRole('button',{name:'切换投篮昼夜'}).click();
  await page.screenshot({path:'output/playwright/basketball-night.png'});
  checks.push('wardrobe persists, panel survives pointer exit, night preview');
  await page.getByRole('button',{name:'切换投篮昼夜'}).click();
  await page.locator('.hoop-distance-cards>button').nth(2).click();await page.mouse.move(1250,950);
  await page.screenshot({path:'output/playwright/basketball-preview.png',fullPage:true});
  assert(errors.length===0,errors.join('\n'));
  return {passed:checks.length,checks,errors};
}
