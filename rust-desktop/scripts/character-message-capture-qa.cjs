async page=>{
 const root='rust-desktop/docs/design/character-messages-v5';
 await page.setViewportSize({width:750,height:460});
 for(const scene of ['feidudu','hamster','beaver','dinosaur','cultivation']){
  await page.goto(`http://127.0.0.1:5188/tests/fixtures/desktop.html?scene=${scene}&width=440&canvas=wide&messages=1&motion=off&random=off&percent=100`);
  await page.bringToFront();await page.locator('.character-mail-art[data-ready=true]').waitFor();await page.waitForTimeout(350);
  for(const percent of [100,68,15]){await page.evaluate(v=>window.__setQuota(v),percent);await page.waitForTimeout(200);await page.locator(`.${scene}-widget`).screenshot({path:`${root}/${scene}-${percent}.png`});}
 }
 await page.goto('http://127.0.0.1:5188/tests/fixtures/desktop.html?scene=cultivation&width=190&canvas=wide&messages=1&motion=off&random=off&percent=68');
 await page.locator('.character-mail-art[data-ready=true]').waitFor();await page.waitForTimeout(200);await page.locator('.cultivation-widget').screenshot({path:`${root}/cultivation-mini.png`});
 const motions=await page.evaluate(async()=>{
  const {loadDinosaurParts,createDinosaurMotionRenderer}=await import('/src/dinosaur/motionRenderer.ts');const renderer=createDinosaurMotionRenderer(await loadDinosaurParts(),'classic'),canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');let samples=0;
  for(const motion of ['phone','fly','look','stretch','yawn'])for(const progress of [0,.03,.12,.3,.5,.7,.95,1]){let calls=0;renderer(ctx,motion,progress,(ctx,rect)=>{calls++;if(ctx.globalAlpha!==1)throw Error(`${motion}/${progress}: fading mail`);if(!Object.values(rect).every(Number.isFinite))throw Error('invalid bounds')});if(calls!==1)throw Error(`${motion}/${progress}: ${calls} props`);samples++}return samples;
 });
 await page.goto('http://127.0.0.1:5188/docs/design/character-messages-v5/overview.html');await page.setViewportSize({width:1400,height:800});await page.screenshot({path:`${root}/overview.png`,fullPage:true});return {motionBoundarySamples:motions,overview:`${root}/overview.png`};
}
