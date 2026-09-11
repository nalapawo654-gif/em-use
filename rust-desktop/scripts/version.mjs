import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const root=fileURLToPath(new URL('../',import.meta.url))
export function validateVersion(v) { if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v)) throw new Error('Use a stable SemVer such as 0.4.1'); return v }
export function checkVersion() {
  const pkg=JSON.parse(readFileSync(resolve(root,'package.json'))), conf=JSON.parse(readFileSync(resolve(root,'src-tauri/tauri.conf.json')))
  const cargo=readFileSync(resolve(root,'src-tauri/Cargo.toml'),'utf8').match(/^version = "([^"]+)"/m)?.[1]
  const lock=JSON.parse(readFileSync(resolve(root,'package-lock.json')))
  const cargoLock=readFileSync(resolve(root,'src-tauri/Cargo.lock'),'utf8').match(/name = "em-use-rust"\r?\nversion = "([^"]+)"/)?.[1]
  if ([conf.version,cargo,cargoLock,lock.version,lock.packages[''].version].some(v=>v!==pkg.version)) throw new Error('Package, lock, Cargo and Tauri versions must match')
  validateVersion(pkg.version)
  if (process.env.RELEASE_TAG && process.env.RELEASE_TAG!==`v${pkg.version}`) throw new Error('Release tag does not match Rust application version')
  return pkg.version
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const version=process.argv[2]
  if (version && version!=='--check') {
    validateVersion(version)
    for (const f of ['package.json','src-tauri/tauri.conf.json','package-lock.json']) {
      const path=resolve(root,f), data=JSON.parse(readFileSync(path));data.version=version;if(data.packages)data.packages[''].version=version;writeFileSync(path,JSON.stringify(data,null,2)+'\n')
    }
    const cargo=resolve(root,'src-tauri/Cargo.toml');writeFileSync(cargo,readFileSync(cargo,'utf8').replace(/^version = "[^"]+"/m,`version = "${version}"`))
    const lock=resolve(root,'src-tauri/Cargo.lock');writeFileSync(lock,readFileSync(lock,'utf8').replace(/(name = "em-use-rust"\r?\nversion = ")[^"]+/,(_match,prefix)=>prefix+version))
  }
  console.log(`EM Use ${checkVersion()}`)
}
