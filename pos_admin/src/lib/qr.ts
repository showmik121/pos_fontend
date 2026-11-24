/**
 * Minimal QR Code encoder: byte mode, error-correction level M, versions 1–15 (see MAX_BYTES).
 * Pure and dependency-free (the panel is built offline and ships no third-party runtime code). It exists to show the
 * authenticator setup as a scannable code; the output is checked module-for-module against a reference encoder in tests/qr.test.ts.
 */

const MIN_VERSION = 1
const MAX_VERSION = 15

/** error-correction codewords per block and block count, level M, indexed by version (index 0 unused) */
const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24]
const NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10]

export type QrMatrix = boolean[][]

function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (ver >= 7) result -= 36
  }
  return result
}

function dataCodewords(ver: number): number {
  return Math.floor(rawDataModules(ver) / 8) - (ECC_PER_BLOCK[ver] ?? 0) * (NUM_BLOCKS[ver] ?? 0)
}

/** most bytes a version holds in byte mode */
function byteCapacity(ver: number): number {
  const countBits = ver <= 9 ? 8 : 16
  return Math.floor((dataCodewords(ver) * 8 - 4 - countBits) / 8)
}

export const MAX_BYTES = byteCapacity(MAX_VERSION)

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return []
  const numAlign = Math.floor(ver / 7) + 2
  const step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2
  const result = [6]
  for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos)
  return result
}

// GF(256) arithmetic with the QR polynomial 0x11D
function gfMultiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function reedSolomonDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j] ?? 0, root)
      if (j + 1 < result.length) result[j] = (result[j] ?? 0) ^ (result[j + 1] ?? 0)
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

function reedSolomonRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0)
  for (const b of data) {
    const factor = b ^ (result.shift() ?? 0)
    result.push(0)
    divisor.forEach((coef, i) => {
      result[i] = (result[i] ?? 0) ^ gfMultiply(coef, factor)
    })
  }
  return result
}

function utf8Bytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text))
}

/** data codewords: mode, length, bytes, terminator, padding */
function buildDataCodewords(bytes: number[], ver: number): number[] {
  const bits: number[] = []
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, ver <= 9 ? 8 : 16)
  for (const b of bytes) push(b, 8)
  const capacityBits = dataCodewords(ver) * 8
  push(0, Math.min(4, capacityBits - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  const out: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i + j] ?? 0)
    out.push(v)
  }
  for (let pad = 0xec; out.length < dataCodewords(ver); pad ^= 0xec ^ 0x11) out.push(pad)
  return out
}

/** split into blocks, add error correction, interleave */
function addEccAndInterleave(data: number[], ver: number): number[] {
  const numBlocks = NUM_BLOCKS[ver] ?? 1
  const eccLen = ECC_PER_BLOCK[ver] ?? 0
  const rawCodewords = Math.floor(rawDataModules(ver) / 8)
  const numShort = numBlocks - (rawCodewords % numBlocks)
  const shortLen = Math.floor(rawCodewords / numBlocks)
  const divisor = reedSolomonDivisor(eccLen)
  const blocks: number[][] = []
  let k = 0
  for (let i = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1))
    k += dat.length
    const ecc = reedSolomonRemainder(dat, divisor)
    if (i < numShort) dat.push(0) // placeholder so every block has the same length while interleaving
    blocks.push([...dat, ...ecc])
  }
  const result: number[] = []
  const blockLen = blocks[0]?.length ?? 0
  for (let i = 0; i < blockLen; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) result.push(block[i] ?? 0)
    })
  }
  return result
}

class Grid {
  readonly modules: boolean[][]
  readonly isFunction: boolean[][]
  constructor(readonly size: number) {
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
    this.isFunction = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  }
  setFunction(x: number, y: number, dark: boolean) {
    const m = this.modules[y]
    const f = this.isFunction[y]
    if (!m || !f) return
    m[x] = dark
    f[x] = true
  }
  get(x: number, y: number): boolean {
    return this.modules[y]?.[x] ?? false
  }
}

function drawFinder(g: Grid, cx: number, cy: number) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || y < 0 || x >= g.size || y >= g.size) continue
      const dist = Math.max(Math.abs(dx), Math.abs(dy))
      g.setFunction(x, y, dist !== 2 && dist !== 4)
    }
  }
}

function drawFunctionPatterns(g: Grid, ver: number) {
  for (let i = 0; i < g.size; i++) {
    g.setFunction(6, i, i % 2 === 0)
    g.setFunction(i, 6, i % 2 === 0)
  }
  drawFinder(g, 3, 3)
  drawFinder(g, g.size - 4, 3)
  drawFinder(g, 3, g.size - 4)
  const align = alignmentPositions(ver)
  const last = align.length - 1
  align.forEach((cy, i) => {
    align.forEach((cx, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) g.setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    })
  })
  drawFormat(g, 0) // reserve the format area; real bits come after masking
  if (ver >= 7) {
    let rem = ver
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (ver << 12) | rem
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0
      const a = g.size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      g.setFunction(a, b, bit)
      g.setFunction(b, a, bit)
    }
  }
}

/** level M has format code 0, so the 5 data bits are just the mask number */
function drawFormat(g: Grid, mask: number) {
  let rem = mask
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  const bits = ((mask << 10) | rem) ^ 0x5412
  const bit = (i: number) => ((bits >>> i) & 1) !== 0
  for (let i = 0; i <= 5; i++) g.setFunction(8, i, bit(i))
  g.setFunction(8, 7, bit(6))
  g.setFunction(8, 8, bit(7))
  g.setFunction(7, 8, bit(8))
  for (let i = 9; i < 15; i++) g.setFunction(14 - i, 8, bit(i))
  for (let i = 0; i < 8; i++) g.setFunction(g.size - 1 - i, 8, bit(i))
  for (let i = 8; i < 15; i++) g.setFunction(8, g.size - 15 + i, bit(i))
  g.setFunction(8, g.size - 8, true)
}

function placeData(g: Grid, codewords: number[]) {
  let i = 0
  for (let right = g.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < g.size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? g.size - 1 - vert : vert
        const row = g.modules[y]
        if (!row || g.isFunction[y]?.[x] || i >= codewords.length * 8) continue
        row[x] = (((codewords[i >>> 3] ?? 0) >>> (7 - (i & 7))) & 1) !== 0
        i++
      }
    }
  }
}

function maskApplies(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0
    case 1: return y % 2 === 0
    case 2: return x % 3 === 0
    case 3: return (x + y) % 3 === 0
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6: return ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0
    default: return ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0
  }
}

function applyMask(g: Grid, mask: number) {
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (!g.isFunction[y]?.[x] && maskApplies(mask, x, y)) {
        const row = g.modules[y]
        if (row) row[x] = !row[x]
      }
    }
  }
}

const FINDER_A = [true, false, true, true, true, false, true, false, false, false, false]
const FINDER_B = [false, false, false, false, true, false, true, true, true, false, true]

function linePenalty(line: boolean[]): number {
  let penalty = 0
  let run = 1
  for (let i = 1; i <= line.length; i++) {
    if (i < line.length && line[i] === line[i - 1]) run++
    else {
      if (run >= 5) penalty += 3 + (run - 5)
      run = 1
    }
  }
  for (let i = 0; i + 11 <= line.length; i++) {
    const w = line.slice(i, i + 11)
    if (w.every((v, k) => v === FINDER_A[k]) || w.every((v, k) => v === FINDER_B[k])) penalty += 40
  }
  return penalty
}

function penalty(g: Grid): number {
  let total = 0
  let dark = 0
  for (let y = 0; y < g.size; y++) {
    const row = g.modules[y] ?? []
    total += linePenalty(row)
    dark += row.filter(Boolean).length
    if (y + 1 < g.size) {
      for (let x = 0; x + 1 < g.size; x++) {
        const c = g.get(x, y)
        if (c === g.get(x + 1, y) && c === g.get(x, y + 1) && c === g.get(x + 1, y + 1)) total += 3
      }
    }
  }
  for (let x = 0; x < g.size; x++) total += linePenalty(g.modules.map((row) => row[x] ?? false))
  const cells = g.size * g.size
  total += (Math.ceil(Math.abs(dark * 20 - cells * 10) / cells) - 1) * 10
  return total
}

/** QR modules for `text` (true = dark). Throws when the text is longer than MAX_BYTES. */
export function encodeQr(text: string, forceMask?: number): QrMatrix {
  const bytes = utf8Bytes(text)
  let ver = MIN_VERSION
  while (ver <= MAX_VERSION && byteCapacity(ver) < bytes.length) ver++
  if (ver > MAX_VERSION) throw new Error(`QR text too long (${bytes.length} bytes, max ${MAX_BYTES})`)
  const codewords = addEccAndInterleave(buildDataCodewords(bytes, ver), ver)
  const size = ver * 4 + 17
  let best: Grid | null = null
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask !== undefined && mask !== forceMask) continue
    const g = new Grid(size)
    drawFunctionPatterns(g, ver)
    placeData(g, codewords)
    applyMask(g, mask)
    drawFormat(g, mask)
    const score = penalty(g)
    if (score < bestScore) {
      best = g
      bestScore = score
    }
  }
  return (best as Grid).modules
}
