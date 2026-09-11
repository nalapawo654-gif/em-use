async (page) => {
  const p=await page.context().newPage();await p.setViewportSize({width:640,height:560});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5174/tests/fixtures/desktop.html?scene=hamster&motion=off');
  await p.waitForLoadState('networkidle');
  const results=[];
  for(const scene of ['aquarium','buddy','beaver','hamster','cultivation','battery']) {
    for(const size of ['standard','compact','mini']) {
      await p.evaluate(async({scene,size})=>window.emUse.settings({scene,size,theme:'night',reducedMotion:true,cultivationRandom:false}),{scene,size});
      await p.waitForLoadState('networkidle');
      await p.mouse.move(620,540);
      const button=p.getByRole('button',{name:/设置$/});
      await button.waitFor({state:'hidden'});
      const hidden=!(await button.isVisible());
      await p.mouse.move(100,100);
      await button.waitFor({state:'visible'});
      const width=await p.evaluate(()=>document.body.getBoundingClientRect().width);
      results.push({scene,size,hiddenBeforeHover:hidden,settingsVisible:await button.isVisible(),width});
    }
  }
  const downloadPromise=page.waitForEvent('download');
  await page.evaluate(data=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='interaction.json';a.click();},{results,errors});
  await (await downloadPromise).saveAs('rust-desktop/docs/interaction-qa.json');
  await p.close();

}
