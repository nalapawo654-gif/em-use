import test from 'node:test'
import assert from 'node:assert/strict'
import {targetFor,binaryName} from './prepare-collaboration.mjs'
test('sidecar follows requested platform instead of the build host',()=>{
  assert.equal(targetFor({EM_USE_MCP_TARGET:'x86_64-pc-windows-msvc'},'aarch64-apple-darwin'),'x86_64-pc-windows-msvc')
  assert.equal(targetFor({TAURI_ENV_PLATFORM:'windows',TAURI_ENV_ARCH:'x86_64'},'aarch64-apple-darwin'),'x86_64-pc-windows-msvc')
  assert.equal(targetFor({},'aarch64-apple-darwin'),'aarch64-apple-darwin')
  assert.equal(binaryName('x86_64-pc-windows-msvc'),'em-use-collab-mcp.exe')
  assert.throws(()=>targetFor({EM_USE_MCP_TARGET:'universal-apple-darwin'},'aarch64-apple-darwin'))
})
