import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildSite, platforms } from './release-site.mjs'
import { validateVersion, checkVersion } from './version.mjs'
function fixture(fn){const root=mkdtempSync(join(tmpdir(),'em-release-'));try{for(const platform of platforms){const dir=join(root,'input',platform);mkdirSync(dir,{recursive:true});const file=`EM-Use-0.4.0-${platform}${platform.startsWith('windows')?'.exe':'.app.tar.gz'}`;writeFileSync(join(dir,file),'fixture');writeFileSync(join(dir,`${file}.sig`),'test-signature');writeFileSync(join(dir,'artifact.json'),JSON.stringify({version:'0.4.0',platform,installers:[file],update:{file,signature:'test-signature'}}))}fn(root)}finally{rmSync(root,{recursive:true,force:true})}}
test('version sources agree and stable releases reject ambiguous tags',()=>{assert.ok(checkVersion());for(const v of ['01.2.3','1.2','1.2.3-beta','../1.2.3'])assert.throws(()=>validateVersion(v))})
test('complete platform matrix generates static manifest and immutable version directory',()=>fixture(root=>{const m=buildSite(join(root,'input'),join(root,'out'),'0.4.0');assert.equal(Object.keys(m.platforms).length,3);assert.match(m.platforms['darwin-aarch64'].url,/172\.27\.12\.77:5500\/em-use\/releases\/0.4.0\/.*\.app\.tar\.gz$/);assert.equal(readFileSync(join(root,'out/em-use/releases/0.4.0/SHA256SUMS.txt'),'utf8').trim().split('\n').length,6);assert.throws(()=>buildSite(join(root,'input'),join(root,'out'),'0.4.0'))}))
test('missing platform or signature prevents publishing latest',()=>fixture(root=>{rmSync(join(root,'input/windows-x86_64'),{recursive:true});assert.throws(()=>buildSite(join(root,'input'),join(root,'out'),'0.4.0'))}))
test('mismatched signature prevents publishing',()=>fixture(root=>{const dir=join(root,'input/windows-x86_64');writeFileSync(join(dir,'EM-Use-0.4.0-windows-x86_64.exe.sig'),'different');assert.throws(()=>buildSite(join(root,'input'),join(root,'out'),'0.4.0'))}))
