import { readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { binaryName } from './prepare-collaboration.mjs'

export function verifySidecar(target, directory) {
  const binary = join(directory, binaryName(target))
  const stat = statSync(binary)
  if (!stat.isFile() || stat.size === 0 || (!target.includes('windows') && !(stat.mode & 0o111))) throw new Error('Packaged MCP is missing or not executable')
  const data = readFileSync(binary)
  if (target.endsWith('apple-darwin')) {
    const expected = target.startsWith('aarch64') ? 0x0100000c : 0x01000007
    if (data.readUInt32LE(0)!==0xfeedfacf || data.readUInt32LE(4)!==expected) throw new Error('Packaged MCP Mach-O architecture mismatch')
  } else if (target.includes('windows')) {
    const pe = data.readUInt32LE(0x3c)
    const expected = target.startsWith('aarch64') ? 0xaa64 : 0x8664
    if(data.toString('ascii',0,2)!=='MZ'||data.readUInt32LE(pe)!==0x4550||data.readUInt16LE(pe+4)!==expected) throw new Error('Packaged MCP PE architecture mismatch')
  }
  const result=spawnSync(binary,['--version'],{encoding:'utf8',timeout:15000})
  if(result.status!==0||!/^em-use-collab-mcp \d+\.\d+\.\d+\s*$/.test(result.stdout||''))throw new Error(`Packaged MCP cannot launch: ${result.error?.message||result.stderr||result.status}`)
  return {binary,target,version:result.stdout.trim(),size:stat.size}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifySidecar(process.argv[2],resolve(process.argv[3])),null,2))
