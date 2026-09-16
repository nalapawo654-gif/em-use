#!/usr/bin/env bash
set -euo pipefail
bundle_dir="${1:?Expected Tauri bundle directory}"
verify_app() {
  local app="$1"
  if [[ ! -s "$app/Contents/_CodeSignature/CodeResources" ]]; then
    echo "Missing signed resource envelope: $app" >&2
    return 1
  fi
  /usr/bin/codesign --verify --deep --strict --verbose=2 "$app"
}
verify_app "$bundle_dir/macos/EM Use.app"
shopt -s nullglob
dmgs=("$bundle_dir"/dmg/*.dmg)
if [[ ${#dmgs[@]} -ne 1 ]]; then
  echo 'Expected exactly one macOS DMG' >&2
  exit 1
fi
mount_dir="$(mktemp -d)"
cleanup() {
  /usr/bin/hdiutil detach "$mount_dir" -quiet || true
  rmdir "$mount_dir" || true
}
trap cleanup EXIT
/usr/bin/hdiutil attach "${dmgs[0]}" -readonly -nobrowse -mountpoint "$mount_dir" -quiet
verify_app "$mount_dir/EM Use.app"
