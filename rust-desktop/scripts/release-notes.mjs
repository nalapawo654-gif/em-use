import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateVersion, checkVersion } from './version.mjs'
const directory=fileURLToPath(new URL('../release-notes/',import.meta.url))
export function readReleaseNotes(version,dir=directory) {
  validateVersion(version)
  const notes=readFileSync(resolve(dir,`${version}.md`),'utf8').trim()
  if (!notes || notes.length>12000) throw new Error(`Missing or oversized release notes for ${version}`)
  return notes
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const version=checkVersion();readReleaseNotes(version);console.log(`Release notes ready for ${version}`)
}
