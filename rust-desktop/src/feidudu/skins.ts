import type { FeiduduSkin } from '../shared/types'

// Recolor the golden body in HSV space. Preserve the original light/shadow,
// cream belly, eyes, brown nose and non-yellow props; do not change alpha.
const PALETTES = {
  'black-purple': { hue: 264, saturation: .68, brightness: .64 },
  'eleme-blue': { hue: 203, saturation: .95, brightness: 1 },
  'jd-red': { hue: 356, saturation: .87, brightness: .94 },
} as const
export function hasFeiduduTint(skin: FeiduduSkin): skin is keyof typeof PALETTES { return skin in PALETTES }
export function tintFeiduduPixels(data: Uint8ClampedArray, skin: FeiduduSkin): void {
  if (!hasFeiduduTint(skin)) return
  const palette = PALETTES[skin], hue = palette.hue / 60
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    const r = data[i]! / 255, g = data[i + 1]! / 255, b = data[i + 2]! / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
    if (delta === 0 || max === 0) continue
    const saturation = delta / max
    const sourceHue = ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360
    // A soft saturation mask keeps the pale belly creamy and avoids a hard seam.
    const coverage = Math.min(1, Math.max(0, (saturation - .38) / .30)) * Math.min(1, Math.max(0, (sourceHue - 30) / 8), Math.max(0, (76 - sourceHue) / 12))
    if (coverage === 0) continue
    const luminance = .2126 * r + .7152 * g + .0722 * b
    const v = Math.min(1, luminance / .90) * palette.brightness
    const s = palette.saturation * (.65 + .35 * saturation)
    const chroma = v * s, x = chroma * (1 - Math.abs(hue % 2 - 1)), m = v - chroma
    const rgb = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x]
    data[i] = Math.round((r * (1 - coverage) + (rgb[0]! + m) * coverage) * 255)
    data[i + 1] = Math.round((g * (1 - coverage) + (rgb[1]! + m) * coverage) * 255)
    data[i + 2] = Math.round((b * (1 - coverage) + (rgb[2]! + m) * coverage) * 255)
  }
}
