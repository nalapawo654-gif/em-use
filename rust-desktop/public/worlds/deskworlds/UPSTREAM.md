# Vendored riverbed

Source: https://github.com/chaseleantj/deskworlds
Revision: `42ad88c98b394efddb071016f2df40d3c2032c96`
Copyright: Chase Lean, 2026. MIT license: `LICENSE`.
Bundled Three.js: `vendor/THREE-LICENSE.txt` (MIT).

Only riverbed rendering, shared helpers, Three.js and required UI styles/icons are included.
No macOS installer, gallery, remote resources or other worlds are shipped.
The only scene-source adaptation replaces bare `from "three"` imports with
relative paths to the bundled `vendor/three.module.js`. This avoids inline import
maps and does not weaken the application's script CSP. One upstream mixed-indentation
line in `vendor/three.core.js` is whitespace-normalized without behavior changes.

EM Use owns `world.html`, `src/worlds/host.ts` and the Windows host.
Those implement lifecycle, first-frame readiness, pointer transport and controls.
Destroying the dedicated world webview releases its whole scene, listeners and GPU context.
