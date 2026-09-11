// Pass this function to playwright-cli run-code. Visual fixture only; no account traffic.
async (page) => {
  const results=[];
  for(const scene of ['aquarium','buddy','beaver','hamster','cultivation','battery']) {
    const captures=[];
    for(const port of [5173,5174]) {
      const p=await page.context().newPage();
      const errors=[]; p.on('pageerror',error=>errors.push(error.message));
      await p.setViewportSize({width:640,height:560});
      await p.addInitScript(() => {
        let seed=12345, time=0, id=0; const frames=new Map();
        Math.random=()=>((seed=Math.imul(1664525,seed)+1013904223>>>0)/4294967296);
        Object.defineProperty(performance,'now',{value:()=>time});
        Date.now=()=>1789099200000+time;
        window.__qaImages=[]; const NativeImage=window.Image; window.Image=function(...args){const img=new NativeImage(...args);window.__qaImages.push(img);return img;};
        window.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};
        window.cancelAnimationFrame=id=>frames.delete(id);
        window.__step=ms=>{for(let end=time+ms;time<end;time+=16){const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(time));} document.getAnimations().forEach(a=>{a.pause();a.currentTime=time;});};
      });
      await p.goto(`http://127.0.0.1:${port}/tests/fixtures/desktop.html?scene=${scene}&motion=off&random=off`);
      await p.waitForLoadState('networkidle');
      // Both builds run the exact same native renderer, with a development-only in-memory bridge.
      await p.evaluate(async scene=>{await window.emUse.settings({scene,theme:'day',reducedMotion:true,cultivationRandom:false});},scene);
      await p.waitForLoadState('networkidle');
      await p.waitForFunction(()=>[...document.images,...window.__qaImages].every(i=>i.complete&&i.naturalWidth),null,{polling:50});
      if(scene==='battery') await p.locator('.battery-visual[data-loaded="true"]').waitFor();
      await p.evaluate(()=>window.__step(1008));
      const broken=await p.evaluate(()=>[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src));
      const before=await p.screenshot({path:`rust-desktop/output/playwright/${scene}-${port}-day.png`,omitBackground:true});
      await p.evaluate(async()=>window.emUse.settings({reducedMotion:false}));
      await p.evaluate(()=>window.__step(608));
      const motion1=await p.screenshot({path:`rust-desktop/output/playwright/${scene}-${port}-motion-a.png`,omitBackground:true});
      await p.evaluate(()=>window.__step(608));
      const motion2=await p.screenshot({path:`rust-desktop/output/playwright/${scene}-${port}-motion-b.png`,omitBackground:true});
      captures.push({before,motion1,motion2});
      results.push({scene,port,broken,errors,animationChanged:!motion1.equals(motion2)});
      await p.close();
    }
    results.push({scene,staticByteEqual:captures[0].before.equals(captures[1].before),motionAByteEqual:captures[0].motion1.equals(captures[1].motion1),motionBByteEqual:captures[0].motion2.equals(captures[1].motion2)});
  }
  return results;
}
