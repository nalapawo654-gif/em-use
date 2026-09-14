import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderDownloadPage, pets } from './download-page.mjs'
import { validateVersion } from './version.mjs'

// Rebuild the explanation page using metadata for installers already published.
// This deliberately creates no installers, release metadata, or updater manifest.
const [metadata, destination] = process.argv.slice(2)
if (!metadata || !destination) throw new Error('Usage: node scripts/website-only.mjs downloads.json output-directory')
const { version, downloads } = JSON.parse(readFileSync(metadata, 'utf8'))
validateVersion(version)
const output = resolve(destination)
if (existsSync(output)) throw new Error('Use a new output directory to avoid including old release files')
const page = renderDownloadPage(version, downloads)
const assets = join(output, 'em-use', 'site-assets', version)
mkdirSync(assets, { recursive: true })
for (const pet of pets) copyFileSync(fileURLToPath(new URL(`../../website/assets/${pet.id}.webp`, import.meta.url)), join(assets, `${pet.id}.webp`))
writeFileSync(join(output, 'index.html'), page)
writeFileSync(join(output, 'em-use', 'index.html'), page)
writeFileSync(join(output, '替换说明.txt'), `EM Use v${version} 说明页更新（${pets.length} 只桌宠）\n\n1. 先将 em-use/site-assets/${version}/ 合并复制到网站根目录的同名路径。\n2. 再覆盖网站根目录 index.html 和 em-use/index.html。\n3. 浏览器强制刷新（Windows: Ctrl+F5；Mac: Cmd+Shift+R）。\n\n网站根目录指 http://172.27.12.77:5500/ 对应的目录。\n请选择合并目录，不要删除或整体替换服务器上的 em-use 目录。\n本包仅含说明页和展示图片，不含安装包，不修改 em-use/releases/ 与 em-use/stable/latest.json。\n下载链接继续使用线上 v${version} 安装包。\n`)
console.log(output)
