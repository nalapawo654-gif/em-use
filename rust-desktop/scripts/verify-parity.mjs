import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
const root=fileURLToPath(new URL('../',import.meta.url)),legacy=resolve(root,'..')
const allowed=new Set(['src/bridge.ts','src/shared/types.ts','src/components/SettingsPanel.vue'])
function walk(dir,prefix=''){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name),`${prefix}${e.name}/`):[`${prefix}${e.name}`])}
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
let count=0;const changed=[]
for(const folder of ['src','public'])for(const file of walk(join(legacy,folder))){const path=`${folder}/${file}`;if(allowed.has(path))continue;count++;try{if(digest(join(root,path))!==digest(join(legacy,path)))changed.push(path)}catch{changed.push(path)}}
if(changed.length)throw new Error(`Renderer/asset parity failed:\n${changed.join('\n')}`)
console.log(`${count} renderer, motion, shared-gesture and asset files are byte-identical to Electron. Explicit integration exceptions: ${[...allowed].join(', ')}`)
