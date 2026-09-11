// Use with playwright-cli run-code against the local generated site preview.
async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5186/');await page.setViewportSize({width:1440,height:1100});await page.waitForLoadState('networkidle');await page.locator('.hero-pet').evaluate(i=>i.decode());
 const pets=[];for(const name of ['额度小鱼缸','充气牛马','林间海狸鼠','仓鼠跑轮','修仙小伙伴','健身小电池']){await page.getByRole('button',{name,exact:true}).click();await page.locator('#pet-image').evaluate(i=>i.decode());pets.push({name,title:await page.locator('#pet-title').textContent(),pressed:await page.getByRole('button',{name,exact:true}).getAttribute('aria-pressed')});}
 await page.getByRole('button',{name:'仓鼠跑轮',exact:true}).click();await page.locator('#pet-image').evaluate(i=>i.decode());await page.screenshot({path:'rust-desktop/output/playwright/download-full.png',fullPage:true,animations:'disabled'});
 const downloads=await page.locator('.download-button').evaluateAll(a=>a.map(a=>({text:a.textContent.trim(),href:a.getAttribute('href')})));
 await page.getByText('已经安装过了，怎么更新？',{exact:false}).click();const faqOpen=await page.locator('details[open]').count();
 const widths=[];for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`rust-desktop/output/playwright/download-mobile-${width}.png`,fullPage:true,animations:'disabled'});widths.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)})));}
 if(errors.length||widths.some(w=>w.scrollWidth>w.width||w.broken.length)||pets.some(p=>p.title!==p.name||p.pressed!=='true')||faqOpen!==1)throw Error(JSON.stringify({errors,widths,pets,faqOpen}));return{errors,widths,pets,downloads,faqOpen};
}
