import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const website=fileURLToPath(new URL('../../website/',import.meta.url))
export const pets=[
  {id:'aquarium',name:'额度小鱼缸',tag:'水位起落，额度心里有数',description:'一只小鱼、一缸清水。额度变成看得见的水位，喂食、换装和小互动，让等待响应的片刻也有趣。'},
  {id:'buddy',name:'充气牛马',tag:'工作搭子，也需要打打气',description:'圆滚滚的牛马在桌面等你。用饱满程度感知额度变化，换个装扮、互动一下，给工作日一点松弛感。'},
  {id:'beaver',name:'林间海狸鼠',tag:'忙着筑巢，也忙着陪你',description:'来自林间的小伙伴，带着木头、树叶和自己的小日常。梳梳毛、送根木头，桌面也能有一片小森林。'},
  {id:'hamster',name:'仓鼠跑轮',tag:'小小跑轮，满满干劲',description:'小仓鼠认真跑轮，猫咪在一旁作伴。换上喜欢的装扮，让忙碌的桌面多一点生气。'},
  {id:'cultivation',name:'修仙小伙伴',tag:'工作之余，修一点好心情',description:'换上仙衣，在不同仙境里修炼。打坐、渡劫与小奇遇，让日常额度有了另一种充满想象的模样。'},
  {id:'battery',name:'健身小电池',tag:'能量有多少，一眼就知道',description:'一颗认真健身的小电池，把额度变成能量状态。不同装扮与运动姿态，陪你走过今天的工作节奏。'},
  {id:'feidudu',name:'肥嘟嘟',tag:'胖一点，快乐多一点',description:'软乎乎的长耳伙伴，从元气满满到趴成一张饼。请喝奶茶、投喂饼干、一起躺平，六种配色陪你放松片刻。'},
  {id:'fox',name:'水墨小狐',tag:'一笔墨色，一点灵气',description:'水墨小狐轻轻摆尾，眨眨眼，偶尔拂耳理毛。五种专属互动与三种墨色，让桌角多一份安静的陪伴。'},
  {id:'luckycat',name:'破产招财猫',tag:'招一点财，也招一点开心',description:'会招手、伸懒腰的招财猫，把额度变化藏进日常姿态。十二种互动、自动小动作与四套服装，陪你认真工作，也陪你歇一歇。'},
  {id:'dinosaur',name:'摸鱼小恐龙',tag:'工作有节奏，摸鱼有搭子',description:'一只会拍翼飞行、刷手机的小恐龙，带着十二种角色互动和四种配色来到桌面。额度渐少，它也慢慢进入休息状态。'},
  {id:'skadi',name:'斯卡蒂 · 月汐',tag:'月色落在桌角，夜影陪在身旁',description:'御姐与萝莉双形态，各有六套衣装。六件武器、专属技能与十六种互动，加上夜影黑猫，让月汐陪你度过白天与夜晚。'},
]
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const windowsIcon='<svg class="platform-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 4.5 10.5 3.3V11H2Zm10-1.4L22 1.5V11H12ZM2 12.5h8.5v7.7L2 19Zm10 0h10V22L12 20.4Z"/></svg>'
const macIcon='<svg class="platform-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M9 16v4m6-4v4M6 21h12M3 12h18"/></svg>'
export function renderDownloadPage(version,downloads,prefix='/em-use/'){
  const assets=`${prefix}site-assets/${version}/`, release=`${prefix}releases/${version}/`
  const buttons=pets.map(p=>`<button type="button" data-pet="${p.id}" aria-pressed="${p.id==='hamster'}">${p.name}</button>`).join('')
  const specs=[['windows-x86_64','Windows','64 位 · x64','.exe',windowsIcon,'下载安装程序'],['darwin-aarch64','Mac · Apple 芯片','Apple M 系列 · macOS 12+','.dmg',macIcon,'下载 Apple 芯片版'],['darwin-x86_64','Mac · Intel 芯片','Intel 处理器 · macOS 12+','.dmg',macIcon,'下载 Intel 芯片版']]
  const cards=specs.map(([platform,title,subtitle,extension,icon,label])=>{
    const item=downloads.find(d=>d.platform===platform && d.file.endsWith(extension));if(!item)throw new Error(`Missing user installer for ${platform}`)
    return `<article class="download-card">${icon}<h3>${title}</h3><p class="architecture">${subtitle}</p><a class="download-button" href="${escape(release+encodeURIComponent(item.file))}" download aria-label="${label}"><span>${label}</span><span aria-hidden="true">↓</span></a><div class="file-info"><span>${extension.slice(1).toUpperCase()} 安装包</span><span>${item.bytes==null?'大小以发布包为准':(item.bytes/1e6).toFixed(1)+' MB'}</span></div></article>`
  }).join('')
  return readFileSync(website+'page.html','utf8').replace('/*STYLE*/',readFileSync(website+'style.css','utf8')).replace('/*SCRIPT*/',readFileSync(website+'page.js','utf8').replace('/*PETS*/',JSON.stringify(pets.map(p=>({...p,image:assets+p.id+'.webp'}))))).replace('<!--PET_BUTTONS-->',buttons).replace('<!--DOWNLOAD_CARDS-->',cards).replaceAll('{{PET_COUNT}}',String(pets.length)).replaceAll('{{PET_TOTAL}}',String(pets.length).padStart(2,'0')).replaceAll('{{VERSION}}',escape(version)).replaceAll('{{ASSETS}}',escape(assets)).replaceAll('{{CHECKSUM}}',escape(release+'SHA256SUMS.txt'))
}
