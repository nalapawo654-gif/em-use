import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function targetFor(env, host) {
  const explicit = env.EM_USE_MCP_TARGET || env.CARGO_BUILD_TARGET || env.TAURI_ENV_TARGET_TRIPLE
  let target = explicit || host
  if (!explicit && env.TAURI_ENV_ARCH && env.TAURI_ENV_PLATFORM) {
    const suffix = {windows:'pc-windows-msvc',darwin:'apple-darwin',macos:'apple-darwin',linux:'unknown-linux-gnu'}[env.TAURI_ENV_PLATFORM]
    if (!suffix) throw new Error('Unsupported platform; set EM_USE_MCP_TARGET explicitly')
    target = `${env.TAURI_ENV_ARCH}-${suffix}`
  }
  if (!/^(aarch64|x86_64)-(apple-darwin|pc-windows-msvc|unknown-linux-gnu)$/.test(target)) throw new Error(`Unsupported MCP target: ${target}`)
  return target
}
export function binaryName(target) { return `em-use-collab-mcp${target.includes('windows') ? '.exe' : ''}` }
function run(program, args, options={}) {
  const result = spawnSync(program, args, {cwd:root, stdio:'inherit', ...options})
  if (result.error || result.status !== 0) throw result.error || new Error(`${program} exited ${result.status}`)
  return result
}
export function prepare(env=process.env, release=process.argv.includes('--release')) {
  const host = run('rustc', ['-vV'], {encoding:'utf8',stdio:'pipe'}).stdout.match(/^host: (.+)$/m)?.[1]
  const target = targetFor(env, host), name = binaryName(target)
  // A dedicated target directory keeps the desktop build's locks independent.
  const targetDir = join(root,'collaboration-mcp/target/sidecar')
  const args = ['build','--locked','--manifest-path',join(root,'collaboration-mcp/Cargo.toml'),'--bin','em-use-collab-mcp','--target',target,'--target-dir',targetDir]
  if (release) args.push('--release')
  run('cargo',args,{env})
  const source = join(targetDir,target,release?'release':'debug',name)
  const output = join(root,'src-tauri/binaries',`em-use-collab-mcp-${target}${target.includes('windows')?'.exe':''}`)
  mkdirSync(dirname(output),{recursive:true});copyFileSync(source,output)
  if (!target.includes('windows')) chmodSync(output,0o755)
  const manifest = {target,profile:release?'release':'debug',binary:output,sha256:createHash('sha256').update(readFileSync(output)).digest('hex')}
  writeFileSync(join(dirname(output),`${target}.json`),JSON.stringify(manifest,null,2)+'\n')
  console.log(`Prepared MCP sidecar: ${target} (${manifest.profile})`)
  return manifest
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) prepare()
