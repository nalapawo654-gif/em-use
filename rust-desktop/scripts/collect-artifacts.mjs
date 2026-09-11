import { readdirSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { checkVersion } from './version.mjs'
const [target,bundle,output]=process.argv.slice(2)
const platforms={'x86_64-pc-windows-msvc':'windows-x86_64','aarch64-apple-darwin':'darwin-aarch64','x86_64-apple-darwin':'darwin-x86_64'}
const platform=platforms[target];if(!platform||!bundle||!output)throw new Error('Expected target bundle-dir output-dir')
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)])}
const version=checkVersion(),files=walk(resolve(bundle)),dest=resolve(output,platform);mkdirSync(dest,{recursive:true})
const manifest={version,platform,installers:[],update:null}
for(const ext of platform.startsWith('windows')?['.exe']:['.dmg','.app.tar.gz']){
  const matches=files.filter(f=>f.endsWith(ext));if(matches.length!==1){if(ext==='.app.tar.gz'&&process.env.RELEASE_BUILD!=='true')continue;throw new Error(`Expected one ${ext} for ${platform}, got ${matches.length}`)}
  const source=matches[0],name=`EM-Use-${version}-${platform}${ext}`;copyFileSync(source,join(dest,name))
  if(ext!=='.app.tar.gz')manifest.installers.push(name)
  if(ext==='.exe'||ext==='.app.tar.gz'){
    const sig=files.find(f=>f===`${source}.sig`)
    if(sig){const signature=readFileSync(sig,'utf8').trim();copyFileSync(sig,join(dest,`${name}.sig`));manifest.update={file:name,signature}}
    else if(process.env.RELEASE_BUILD==='true')throw new Error(`Missing signature for ${name}`)
  }
}
writeFileSync(join(dest,'artifact.json'),JSON.stringify(manifest,null,2)+'\n')
