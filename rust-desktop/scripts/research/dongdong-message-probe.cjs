#!/usr/bin/env node
// Local, read-only research probe. No network, message sending, read receipts, or credentials in output.
// Requires an independently installed better-sqlite3-multiple-ciphers; never modifies product dependencies.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const args = process.argv.slice(2);
function option(name, fallback) { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1]; }
const duration = Number(option('--seconds', '180'));
const marker = option('--marker', 'EMUSE-DD-0914');
const asar = option('--asar', '/Applications/咚咚.app/Contents/Resources/app.asar');
const modulePath = option('--sqlite-module', 'better-sqlite3-multiple-ciphers');
const emit = value => console.log(JSON.stringify(value));
function readArchive() {
  const fd = fs.openSync(asar, 'r');
  const header = Buffer.alloc(16); fs.readSync(fd, header, 0, 16, 0);
  const size = header.readUInt32LE(12), base = 8 + header.readUInt32LE(4);
  if (size > 32 * 1024 * 1024 || size < 2) throw Error('Unsupported archive header');
  const bytes = Buffer.alloc(size); fs.readSync(fd, bytes, 0, size, 16);
  const tree = JSON.parse(bytes);
  function node(name) { let current = tree; for (const part of name.split('/')) current = current.files[part]; return current; }
  function read(name) {
    const entry = node(name);
    if (!entry || entry.unpacked || entry.link || entry.size > 16 * 1024 * 1024) throw Error('Unsupported archive entry');
    const data = Buffer.alloc(entry.size); fs.readSync(fd, data, 0, data.length, base + Number(entry.offset)); return data;
  }
  return { node, read, close: () => fs.closeSync(fd) };
}
function fingerprint(file) { return fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null; }
async function main() {
  if (!Number.isFinite(duration) || duration < 1 || duration > 600 || !marker || marker.length > 100) throw Error('Invalid probe options');
  const Database = require(modulePath);
  const root = path.join(os.homedir(), 'Documents/emc');
  let file = option('--db', null);
  if (!file) {
    const candidates = fs.readdirSync(root).map(id => path.join(root, id, 'msg/msg.db')).filter(f => fs.existsSync(f));
    if (candidates.length !== 1) throw Error('Specify --db for the current account; automatic account selection is ambiguous');
    file = candidates[0];
  }
  // Current 3.4.1 layout derives the local DB key from the account directory via bundled WASM.
  const badgeId = path.basename(path.dirname(path.dirname(file)));
  const config = path.join(os.homedir(), 'Library/Application Support/emc/emc.config.v3.json');
  const before = [fingerprint(asar), fingerprint(config)];
  const archive = readArchive(); let wasm, installed;
  try {
    installed = JSON.parse(archive.read('package.json')).version;
    const base = 'seagull/renderer/dist/assets/';
    const entries = Object.keys(archive.node(base.slice(0, -1)).files);
    const heart = entries.find(name => /^heart-.*\.js$/.test(name));
    const source = archive.read(base + heart).toString('utf8');
    const wasmName = source.match(/new URL\("(seagull_wings_bg\.[^"/]+\.wasm)"/)?.[1];
    if (!wasmName || !source.includes('getDbEncryptionKey')) throw Error('Unsupported DongDong DB derivation');
    wasm = archive.read(base + wasmName);
  } finally { archive.close(); }
  const { instance } = await WebAssembly.instantiate(wasm, {}), w = instance.exports;
  const input = Buffer.from(badgeId), p = w.__wbindgen_malloc(input.length, 1), ret = w.__wbindgen_add_to_stack_pointer(-16);
  new Uint8Array(w.memory.buffer).set(input, p); w.getDbEncryptionKey(ret, p, input.length);
  const ints = new Int32Array(w.memory.buffer), kp = ints[ret / 4], kl = ints[ret / 4 + 1];
  let key = Buffer.from(new Uint8Array(w.memory.buffer, kp, kl)).toString('utf8');
  const db = new Database(file, { readonly: true, fileMustExist: true, timeout: 1000 });
  let stop = false; const onStop = () => { stop = true; }; process.on('SIGINT', onStop); process.on('SIGTERM', onStop);
  try {
    db.pragma("key='" + key.replaceAll("'", "''") + "'"); key = ''; input.fill(0); new Uint8Array(w.memory.buffer).fill(0);
    db.pragma('query_only = ON');
    const sample = db.prepare(`SELECT length(m.chat_content)>0 AS content_present,
      EXISTS(SELECT 1 FROM user u WHERE u.badge_id=m.from_id AND length(u.name)>0) AS sender_resolvable,
      EXISTS(SELECT 1 FROM chat c WHERE c.chat_id=m.chat_id AND c.unread_num IS NOT NULL) AS unread_resolvable
      FROM message m WHERE m.msg_type='text' ORDER BY m.rowid DESC LIMIT 1`).get();
    emit({ event: 'readability', textSamplePresent: !!sample, contentPresent: !!sample?.content_present, senderNameResolvable: !!sample?.sender_resolvable, chatUnreadResolvable: !!sample?.unread_resolvable });
    let cursor = db.prepare('SELECT COALESCE(MAX(rowid),0) AS n FROM message').get().n;
    let version = db.pragma('data_version', { simple: true });
    const query = db.prepare('SELECT rowid AS row, msg_type, create_at, from_id, chat_content, is_withdrawn FROM message WHERE rowid > ? ORDER BY rowid LIMIT 200');
    const sender = db.prepare('SELECT COUNT(*) AS n FROM user WHERE badge_id=? AND length(name)>0');
    const started = Date.now(); let arrivals = 0, markerSeen = false;
    emit({ event: 'ready', installedVersion: installed, readonly: db.readonly, queryOnly: db.pragma('query_only', { simple: true }), baselineSet: true, pollMs: 500, durationSeconds: duration });
    while (!stop && Date.now() - started < duration * 1000) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const next = db.pragma('data_version', { simple: true }); if (next === version) continue; version = next;
      let rows;
      do {
        rows = query.all(cursor);
        for (const row of rows) {
          cursor = row.row; arrivals++;
          const content = String(row.chat_content || ''), match = content.includes(marker); markerSeen ||= match;
          const ts = Number(row.create_at), created = ts < 1e11 ? ts * 1000 : ts;
          emit({ event: 'message-arrival', sequence: arrivals, type: /^[a-z_]{1,30}$/.test(row.msg_type) ? row.msg_type : 'other', ageMs: Date.now() - created, contentReadable: content.length > 0, contentLength: content.length, senderNameResolvable: sender.get(row.from_id).n > 0, selfSent: row.from_id === badgeId, withdrawn: !!row.is_withdrawn, testMarkerMatched: match });
        }
      } while (rows.length === 200 && !stop);
    }
    emit({ event: 'done', arrivals, testMarkerMatched: markerSeen, durationMs: Date.now() - started, installationUnchanged: before[0] === fingerprint(asar), loginConfigUnchanged: before[1] === fingerprint(config) });
  } finally { key = ''; db.close(); process.removeListener('SIGINT', onStop); process.removeListener('SIGTERM', onStop); }
}
main().catch(error => { emit({ event: 'error', code: error.code || error.name, message: 'Probe failed; no raw database errors, identities, keys, or chat content are logged.' }); process.exitCode = 1; });
