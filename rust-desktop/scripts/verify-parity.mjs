import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
const root=fileURLToPath(new URL('../',import.meta.url)),legacy=resolve(root,'..')
// Tauri-only integration points evolve after migration; the six legacy pet
// renderers, state machines, assets and shared gesture implementation still match.
const allowed=new Set(['src/bridge.ts','src/shared/types.ts','src/components/SettingsPanel.vue',
  'src/App.vue','src/components/ScenePicker.vue','src/main.ts','src/shared/settings.ts'])
function walk(dir,prefix=''){return readdirSync(dir,{withFileTypes:true}).filter(e=>e.name!=='.DS_Store').flatMap(e=>e.isDirectory()?walk(join(dir,e.name),`${prefix}${e.name}/`):[`${prefix}${e.name}`])}
const noticeIntegrations=JSON.parse(readFileSync(join(root,'docs/notice-integration-baselines.json'))).files
const textDigest=text=>createHash('sha256').update(text).digest('hex')
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
let count=0;const changed=[]
for(const file of walk(join(legacy,'src'))){const path=`src/${file}`;if(allowed.has(path))continue;count++;try{
  // Only the image URL extension changes. Rendering, timing and gestures must match.
  const native=readFileSync(join(root,path),'utf8').replaceAll('.webp','.png'), baseline=readFileSync(join(legacy,path),'utf8'), integration=noticeIntegrations[path]
  if(integration){
    if(textDigest(native)!==integration.native_sha256||textDigest(baseline)!==integration.baseline_sha256)changed.push(path)
  }else if(native!==baseline)changed.push(path)
}catch{changed.push(path)}}
const report=JSON.parse(readFileSync(join(root,'docs/asset-compression.json')))
const nativeAssets=JSON.parse(readFileSync(join(root,'docs/native-assets.json'))).assets
const expected=[...report.images.map(r=>r.target),...nativeAssets.map(r=>r.path)].sort()
for(const row of nativeAssets){try{if(digest(join(root,'public/assets',row.path))!==row.sha256)changed.push(row.path)}catch{changed.push(row.path)}}
if(JSON.stringify(walk(join(root,'public/assets')).sort())!==JSON.stringify(expected))changed.push('unexpected runtime artwork')
for(const row of report.images){try{
  if(digest(join(legacy,'public/assets',row.source))!==row.source_sha256||digest(join(root,'public/assets',row.target))!==row.sha256)changed.push(row.target)
}catch{changed.push(row.target)}}
if(changed.length)throw new Error(`Renderer/asset parity failed:\n${changed.join('\n')}`)
console.log(`${count} renderer, motion and gesture files match the baseline or their reviewed notification integration hashes; ${report.images.length} legacy lossless assets and ${nativeAssets.length} Tauri-only assets match their verified hashes. CI separately decodes and compares every RGBA pixel.`)
