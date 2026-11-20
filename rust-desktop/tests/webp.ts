// Minimal WebP header reader for asset tests (shipped atlases are lossless VP8L).
export function webpInfo(bytes: Uint8Array) {
  const text = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4))
  if (text(0) !== 'RIFF' || text(8) !== 'WEBP') throw new Error('Not a WebP file')
  const chunk = text(12)
  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) throw new Error('Bad VP8L signature')
    const b = bytes[21]! | bytes[22]! << 8 | bytes[23]! << 16 | bytes[24]! << 24
    return { width: (b & 0x3fff) + 1, height: ((b >>> 14) & 0x3fff) + 1, alpha: ((b >>> 28) & 1) === 1, lossless: true }
  }
  if (chunk === 'VP8X') {
    const u24 = (o: number) => bytes[o]! | bytes[o + 1]! << 8 | bytes[o + 2]! << 16
    return { width: u24(24) + 1, height: u24(27) + 1, alpha: (bytes[20]! & 0x10) !== 0, lossless: false }
  }
  throw new Error(`Unsupported WebP chunk ${chunk}`)
}
