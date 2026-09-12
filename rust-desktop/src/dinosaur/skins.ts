import type { DinosaurSkin } from '../shared/types'

const palettes = {
  peach: { hue: 351, saturation: .43, brightness: 1.12 },
  cream: { hue: 47, saturation: .64, brightness: 1.17 },
  charcoal: { hue: 235, saturation: .10, brightness: .36 },
} as const

// Mask only green skin; retain cream belly, orange spikes, blush, eyes and props.
export function tintDinosaurPixels(data: Uint8ClampedArray, skin: DinosaurSkin) {
  if (skin === 'classic') return
  const palette = palettes[skin]
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue
    const r = data[i]! / 255, g = data[i + 1]! / 255, b = data[i + 2]! / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
    if (delta === 0) continue
    const hue = ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360
    const mask = Math.min(1, Math.max(0, (hue - 72) / 18), Math.max(0, (170 - hue) / 20)) * Math.min(1, delta / .10)
    if (!mask) continue
    const h = palette.hue / 60, value = Math.min(1, max * palette.brightness)
    const chroma = value * palette.saturation * (.7 + .3 * delta / max)
    const x = chroma * (1 - Math.abs(h % 2 - 1)), m = value - chroma
    const rgb = h < 1 ? [chroma, x, 0] : h < 2 ? [x, chroma, 0] : h < 3 ? [0, chroma, x] : h < 4 ? [0, x, chroma] : h < 5 ? [x, 0, chroma] : [chroma, 0, x]
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c]! * (1 - mask) + (rgb[c]! + m) * 255 * mask)
  }
}
