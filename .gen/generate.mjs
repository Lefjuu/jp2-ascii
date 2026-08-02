import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Jimp from 'jimp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = join(root, '.gen', 'source.png')
const processedPath = join(root, '.gen', 'processed.png')
const out = join(root, 'ascii.js')

// Special chars only (no letters) — denser midtones than a tiny ramp
const CHARS = " .'`^,:;!~_+-=*#%@&$"
const COLS = 100
const CHAR_ASPECT = 0.5
const ESC = '\u001b'

function isBgPixel (r, g, b, a) {
  if (a < 32) return true
  return r < 12 && g < 12 && b < 12
}

function flattenBackground (img) {
  const { width, height } = img.bitmap
  const visited = new Uint8Array(width * height)
  const queue = []

  const push = (x, y) => {
    const i = y * width + x
    if (visited[i]) return
    const idx = img.getPixelIndex(x, y)
    const r = img.bitmap.data[idx]
    const g = img.bitmap.data[idx + 1]
    const b = img.bitmap.data[idx + 2]
    const a = img.bitmap.data[idx + 3]
    if (!isBgPixel(r, g, b, a)) return
    visited[i] = 1
    queue.push(x, y)
  }

  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }

  while (queue.length) {
    const y = queue.pop()
    const x = queue.pop()
    img.setPixelColor(0xffffffff, x, y)
    if (x > 0) push(x - 1, y)
    if (x + 1 < width) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y + 1 < height) push(x, y + 1)
  }
}

function enhanceSubjectGray (img) {
  const { width, height, data } = img.bitmap
  const vals = []
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i]
    if (v < 250) vals.push(v)
  }
  if (vals.length < 100) return

  vals.sort((a, b) => a - b)
  const lo = vals[Math.floor(vals.length * 0.08)]
  const hi = vals[Math.floor(vals.length * 0.92)]
  const span = Math.max(1, hi - lo)

  img.scan(0, 0, width, height, function (x, y, idx) {
    let v = this.bitmap.data[idx]
    if (v >= 250) return
    v = Math.round(40 + ((v - lo) / span) * 180)
    v = Math.max(30, Math.min(230, v))
    this.bitmap.data[idx] = v
    this.bitmap.data[idx + 1] = v
    this.bitmap.data[idx + 2] = v
  })
}

function subjectBounds (img, pad = 4) {
  const { width, height, data } = img.bitmap
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if ((r + g + b) / 3 < 248) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return { x: 0, y: 0, w: width, h: height }
  }

  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(width - 1, maxX + pad)
  maxY = Math.min(height - 1, maxY + pad)
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function sampleCell (img, col, row, cols, rows) {
  const { width, height, data } = img.bitmap
  const x0 = Math.floor((col / cols) * width)
  const x1 = Math.floor(((col + 1) / cols) * width)
  const y0 = Math.floor((row / rows) * height)
  const y1 = Math.floor(((row + 1) / rows) * height)

  let sumR = 0
  let sumG = 0
  let sumB = 0
  let sumL = 0
  let n = 0
  let subject = 0

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const l = (r + g + b) / 3
      sumR += r
      sumG += g
      sumB += b
      sumL += l
      n++
      if (l < 248) subject++
    }
  }

  if (!n) {
    return { r: 255, g: 255, b: 255, l: 255, bg: true }
  }

  return {
    r: Math.round(sumR / n),
    g: Math.round(sumG / n),
    b: Math.round(sumB / n),
    l: sumL / n,
    bg: subject / n < 0.15
  }
}

function toColoredAscii (colorImg, grayImg, cols) {
  const { width, height } = colorImg.bitmap
  const rows = Math.max(1, Math.round((height / width) * cols * CHAR_ASPECT))
  const levels = CHARS.length - 1
  const lum = new Float64Array(cols * rows)
  const colors = new Array(cols * rows)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col
      const grayCell = sampleCell(grayImg, col, row, cols, rows)
      const colorCell = sampleCell(colorImg, col, row, cols, rows)
      lum[i] = grayCell.l
      colors[i] = colorCell
    }
  }

  const lines = []
  for (let row = 0; row < rows; row++) {
    let line = ''
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col
      const { r, g, b, bg } = colors[i]

      if (bg) {
        line += ' '
        continue
      }

      let v = lum[i]
      const idx = Math.max(0, Math.min(levels, Math.round((1 - v / 255) * levels)))
      const quantized = 255 * (1 - idx / levels)
      const err = v - quantized

      if (col + 1 < cols) lum[i + 1] += (err * 7) / 16
      if (row + 1 < rows) {
        if (col > 0) lum[i + cols - 1] += (err * 3) / 16
        lum[i + cols] += (err * 5) / 16
        if (col + 1 < cols) lum[i + cols + 1] += (err * 1) / 16
      }

      const ch = CHARS[idx]
      if (ch === ' ') {
        line += ' '
      } else {
        line += `${ESC}[38;2;${r};${g};${b}m${ch}${ESC}[0m`
      }
    }
    lines.push(line)
  }

  return lines.join('\n')
}

const colorImg = await Jimp.read(sourcePath)
flattenBackground(colorImg)

const grayImg = colorImg.clone()
grayImg.greyscale()
grayImg.contrast(0.3)
enhanceSubjectGray(grayImg)

const bounds = subjectBounds(colorImg, 4)
colorImg.crop(bounds.x, bounds.y, bounds.w, bounds.h)
grayImg.crop(bounds.x, bounds.y, bounds.w, bounds.h)

await colorImg.writeAsync(processedPath)

const ascii = toColoredAscii(colorImg, grayImg, COLS)
const escaped = ascii
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$/g, '\\$')

writeFileSync(out, `module.exports = \`${escaped}\`\n`)
console.log(`Wrote ${out} (${COLS} cols, ${ascii.split('\n').length} rows, truecolor)`)
console.log(`Processed preview: ${processedPath}`)
