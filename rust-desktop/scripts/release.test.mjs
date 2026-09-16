import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildSite, platforms } from './release-site.mjs'
import { createCiConfig } from './ci-config.mjs'
import { pets } from './download-page.mjs'
import { validateVersion, checkVersion } from './version.mjs'
function fixture(fn) {
  const root=mkdtempSync(join(tmpdir(),'em-release-'))
  try {
    for(const platform of platforms) {
      const dir=join(root,'input',platform);mkdirSync(dir,{recursive:true})
      const windows=platform.startsWith('windows')
      const file=`EM-Use-0.4.0-${platform}${windows?'.exe':'.dmg'}`
      writeFileSync(join(dir,file),'fixture')
      if(windows)writeFileSync(join(dir,`${file}.sig`),'test-signature')
      writeFileSync(join(dir,'artifact.json'),JSON.stringify({version:'0.4.0',platform,installers:[file],update:windows?{file,signature:'test-signature'}:null}))
    }
    fn(root)
  } finally { rmSync(root,{recursive:true,force:true}) }
}
test('version sources agree and stable releases reject ambiguous tags',()=>{assert.ok(checkVersion());for(const v of ['01.2.3','1.2','1.2.3-beta','../1.2.3'])assert.throws(()=>validateVersion(v))})
test('complete platform matrix generates static manifest and immutable version directory',()=>fixture(root=>{const m=buildSite(join(root,'input'),join(root,'out'),'0.4.0');assert.deepEqual(Object.keys(m.platforms),['windows-x86_64']);assert.match(m.platforms['windows-x86_64'].url,/172\.27\.12\.77:5500\/em-use\/releases\/0.4.0\/.*\.exe$/);assert.equal(readFileSync(join(root,'out/em-use/releases/0.4.0/SHA256SUMS.txt'),'utf8').trim().split('\n').length,4);assert.throws(()=>buildSite(join(root,'input'),join(root,'out'),'0.4.0'))}))
test('missing platform or signature prevents publishing latest',()=>fixture(root=>{rmSync(join(root,'input/windows-x86_64'),{recursive:true});assert.throws(()=>buildSite(join(root,'input'),join(root,'out'),'0.4.0'))}))
test('mismatched signature prevents publishing',()=>fixture(root=>{const dir=join(root,'input/windows-x86_64');writeFileSync(join(dir,'EM-Use-0.4.0-windows-x86_64.exe.sig'),'different');assert.throws(()=>buildSite(join(root,'input'),join(root,'out'),'0.4.0'))}))

test('download page explains the product and links to installers from both entry points',()=>fixture(root=>{
  buildSite(join(root,'input'),join(root,'out'),'0.4.0')
  const page=readFileSync(join(root,'out/index.html'),'utf8')
  assert.equal(page,readFileSync(join(root,'out/em-use/index.html'),'utf8'))
  assert.match(page,/东方财富 AI 云平台/)
  assert.ok(page.includes(`${pets.length} 类桌宠`))
  for(const [platform,ext] of [['windows-x86_64','exe'],['darwin-aarch64','dmg'],['darwin-x86_64','dmg']])assert.ok(page.includes(`href="/em-use/releases/0.4.0/EM-Use-0.4.0-${platform}.${ext}"`))
  assert.doesNotMatch(page,/href="[^"]+\.app\.tar\.gz"/)
  for(const {id:pet} of pets)assert.ok(readFileSync(join(root,`out/em-use/site-assets/0.4.0/${pet}.webp`)).length>0)
}))

test('macOS release configuration never requests updater keys or archives',()=>{
  for(const target of ['aarch64-apple-darwin','x86_64-apple-darwin']) {
    assert.deepEqual(createCiConfig(target,{RELEASE_BUILD:'true'},'fixed-key'),{bundle:{createUpdaterArtifacts:false,macOS:{signingIdentity:'-'}}})
    assert.equal(createCiConfig(target,{RELEASE_BUILD:'true',TAURI_SIGNING_PRIVATE_KEY:'fixture',TAURI_UPDATER_PUBLIC_KEY:'other'},'fixed-key').bundle.createUpdaterArtifacts,false)
  }
})
test('Windows retains mandatory updater signing and fixed public key',()=>{
  assert.throws(()=>createCiConfig('x86_64-pc-windows-msvc',{RELEASE_BUILD:'true'},'fixed-key'))
  assert.throws(()=>createCiConfig('x86_64-pc-windows-msvc',{TAURI_UPDATER_PUBLIC_KEY:'other'},'fixed-key'))
  assert.equal(createCiConfig('x86_64-pc-windows-msvc',{RELEASE_BUILD:'true',TAURI_SIGNING_PRIVATE_KEY:'fixture'},'fixed-key').bundle.createUpdaterArtifacts,true)
})
test('missing Windows updater metadata blocks publishing even with manual Mac installers',()=>fixture(root=>{
  const path=join(root,'input/windows-x86_64/artifact.json'),data=JSON.parse(readFileSync(path));data.update=null;writeFileSync(path,JSON.stringify(data))
  assert.throws(()=>buildSite(join(root,'input'),join(root,'out'),'0.4.0'))
}))
