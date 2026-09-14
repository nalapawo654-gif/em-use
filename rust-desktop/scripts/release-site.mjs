import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs'
import { resolve, join, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { validateVersion } from './version.mjs'
import { renderDownloadPage, pets } from './download-page.mjs'
export const platforms=['windows-x86_64','darwin-aarch64','darwin-x86_64']
export function buildSite(input,output,version,base='http://172.27.12.77:5500/') {
  validateVersion(version)
  const baseURL=new URL(base);if(!['http:','https:'].includes(baseURL.protocol)||baseURL.username||baseURL.password)throw new Error('Invalid static server URL')
  const root=resolve(output,'em-use'),release=join(root,'releases',version);if(existsSync(release))throw new Error('Output version already exists; use an empty staging directory')
  const records=platforms.map(platform=>{
    const dir=resolve(input,platform),data=JSON.parse(readFileSync(join(dir,'artifact.json')))
    if(data.version!==version||data.platform!==platform||!data.update?.signature?.trim()||!data.installers?.length)throw new Error(`Incomplete release: ${platform}`)
    const allowed=platform.startsWith('windows')?'.exe':'.app.tar.gz'
    if(!data.update.file.endsWith(allowed))throw new Error('Wrong updater package type')
    const names=[...new Set([...data.installers,data.update.file,`${data.update.file}.sig`])]
    for(const name of names){if(name!==basename(name)||!/^EM-Use-[A-Za-z0-9_.-]+$/.test(name))throw new Error('Unsafe artifact name');if(!existsSync(join(dir,name)))throw new Error(`Missing artifact ${name}`)}
    if(readFileSync(join(dir,`${data.update.file}.sig`),'utf8').trim()!==data.update.signature)throw new Error('Signature sidecar mismatch')
    return {dir,data,names}
  })
  mkdirSync(release,{recursive:true});mkdirSync(join(root,'stable'),{recursive:true})
  const latest={version,notes:`EM Use ${version} · Rust 桌面版`,pub_date:new Date().toISOString(),platforms:{}}
  const sums=[],downloads=[]
  for(const {dir,data,names}of records){for(const name of names){const bytes=readFileSync(join(dir,name));copyFileSync(join(dir,name),join(release,name));sums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`)}
    latest.platforms[data.platform]={signature:data.update.signature,url:new URL(`em-use/releases/${version}/${encodeURIComponent(data.update.file)}`,baseURL).href}
    for(const name of data.installers)downloads.push({platform:data.platform,file:name,bytes:statSync(join(dir,name)).size})
  }
  writeFileSync(join(release,'SHA256SUMS.txt'),sums.join('\n')+'\n')
  writeFileSync(join(release,'version.json'),JSON.stringify(latest,null,2)+'\n')
  const siteAssets=join(root,'site-assets',version);mkdirSync(siteAssets,{recursive:true})
  for(const pet of pets)copyFileSync(fileURLToPath(new URL(`../../website/assets/${pet.id}.webp`,import.meta.url)),join(siteAssets,`${pet.id}.webp`))
  const prefix=new URL('em-use/',baseURL).pathname
  const page=renderDownloadPage(version,downloads,prefix)
  writeFileSync(join(root,'index.html'),page)
  writeFileSync(resolve(output,'index.html'),page)
  writeFileSync(join(root,'stable','latest.json'),JSON.stringify(latest,null,2)+'\n')
  writeFileSync(resolve(output,'UPLOAD-README.txt'),`将 index.html 和 em-use 目录合并到 ${baseURL.href} 对应的网站根目录。\n先上传 em-use/releases/${version}/ 全部文件、em-use/site-assets/${version}/、em-use/index.html 和根目录 index.html，最后上传 em-use/stable/latest.json。\n请保留旧的 releases 目录；不要先删除线上版本。\nlatest.json 建议 Cache-Control: no-cache。更新包已签名，必须沿用原签名密钥。\n`)
  if(process.env.GITHUB_ACTIONS==='true')console.log('INSTALLER_SIZES '+JSON.stringify(downloads))
  return latest
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [input='artifacts',output='release-site',version]=process.argv.slice(2)
  if(!version)throw new Error('Usage: release-site.mjs artifacts output version')
  buildSite(input,output,version)
}
