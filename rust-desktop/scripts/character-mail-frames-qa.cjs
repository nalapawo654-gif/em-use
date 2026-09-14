// Actual corrected atlases, all costumes and all twelve running poses.
async page=>{
 await page.goto('http://127.0.0.1:5188/tests/fixtures/desktop.html?scene=hamster&width=440&messages=1&motion=off');
 const frames=await page.evaluate(async()=>{
  const {loadHamsterSkin}=await import('/src/hamster/sprites.ts'),{renderHamster}=await import('/src/hamster/render.ts'),{loadCharacterMail}=await import('/src/shared/characterMail.ts'),{HAMSTER_SKINS}=await import('/src/shared/types.ts');
  const art=await loadCharacterMail('hamster'),out=[];
  for(const skin of HAMSTER_SKINS){const rig=await loadHamsterSkin(skin.id);
   for(let i=0;i<12;i++){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const frame=renderHamster(canvas.getContext('2d'),rig,i<6?'full':'working','idle',(i%6)*(i<6?90:120),true,skin.id,(ctx,r)=>ctx.drawImage(art,r.x,r.y,r.width,r.height));
    if(frame!==i)throw Error(`${skin.id}: ${i} rendered ${frame}`);
    out.push({name:`${skin.label ?? skin.id} ${i+1}`,image:canvas.toDataURL()});
   }
  }
  return out;
 });
 await page.setContent(`<body style="margin:0;background:#f8f7f2;font:12px sans-serif;display:grid;grid-template-columns:repeat(12,128px)">${frames.map(f=>`<div>${f.name}<img width="128" src="${f.image}"></div>`).join('')}</body>`);
 await page.setViewportSize({width:1536,height:1040});
 await page.screenshot({path:'rust-desktop/docs/design/character-messages-v5/hamster-run-frames.png',fullPage:true});
 return {frames:frames.length,source:'loadHamsterSkin corrected atlas selection',foreground:'same current corrected frame pixels'};
}
