import { formatTaka } from "../domain/money"
import type { Statement } from "../store/statement"

const FONT = '"Noto Sans Bengali", "Noto Sans", sans-serif'
const W = 720
const PAD = 32
const ROW_H = 64

/** কাস্টমারের খাতাকে PNG ছবিতে আঁকে (ক্যানভাস; শুধু ব্রাউজারে) */
export async function drawStatementPng(opts: { storeName: string; customerName: string; statement: Statement; dateText: string }): Promise<Blob | null> {
  try {
    await Promise.all([document.fonts.load(`600 24px ${FONT}`), document.fonts.load(`400 20px ${FONT}`)])
  } catch {
    // ফন্ট না এলেও সিস্টেম ফন্টে আঁকা হবে
  }
  const { rows, balance, skipped } = opts.statement
  const head = 200
  const note = skipped > 0 ? 40 : 0
  const foot = 110
  const H = head + note + rows.length * ROW_H + foot
  const scale = 2
  const canvas = document.createElement("canvas")
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.scale(scale, scale)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = "alphabetic"

  ctx.fillStyle = "#1f2a1f"
  ctx.font = `700 30px ${FONT}`
  ctx.fillText(opts.storeName || "বাকির খাতা", PAD, 56)
  ctx.font = `400 20px ${FONT}`
  ctx.fillStyle = "#6b7280"
  ctx.fillText(`বাকির খাতা · ${opts.dateText}`, PAD, 88)
  ctx.fillStyle = "#1f2a1f"
  ctx.font = `600 26px ${FONT}`
  ctx.fillText(opts.customerName, PAD, 136)
  ctx.font = `400 20px ${FONT}`
  ctx.fillStyle = "#6b7280"
  ctx.fillText("বর্তমান বাকি", PAD, 170)
  ctx.textAlign = "right"
  ctx.font = `700 30px ${FONT}`
  ctx.fillStyle = balance > 0 ? "#b45309" : "#166534"
  ctx.fillText(formatTaka(balance), W - PAD, 170)
  ctx.textAlign = "left"

  let y = head
  ctx.strokeStyle = "#e5e7eb"
  ctx.lineWidth = 1
  if (skipped > 0) {
    ctx.fillStyle = "#6b7280"
    ctx.font = `400 18px ${FONT}`
    ctx.fillText(`আগের ${skipped}টি লেনদেন এখানে নেই`, PAD, y + 20)
    y += note
  }
  for (const r of rows) {
    ctx.beginPath()
    ctx.moveTo(PAD, y)
    ctx.lineTo(W - PAD, y)
    ctx.stroke()
    ctx.fillStyle = "#1f2a1f"
    ctx.font = `600 22px ${FONT}`
    ctx.fillText(r.title, PAD, y + 28)
    ctx.fillStyle = "#6b7280"
    ctx.font = `400 17px ${FONT}`
    ctx.fillText(r.when, PAD, y + 52)
    ctx.textAlign = "right"
    ctx.fillStyle = r.reduces ? "#166534" : "#1f2a1f"
    ctx.font = `600 22px ${FONT}`
    ctx.fillText(r.amountText, W - PAD, y + 28)
    ctx.fillStyle = "#6b7280"
    ctx.font = `400 17px ${FONT}`
    ctx.fillText(`বাকি ${formatTaka(r.balance)}`, W - PAD, y + 52)
    ctx.textAlign = "left"
    y += ROW_H
  }
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(W - PAD, y)
  ctx.stroke()
  ctx.fillStyle = "#6b7280"
  ctx.font = `400 18px ${FONT}`
  ctx.fillText("ধন্যবাদ!", PAD, y + 44)

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"))
}
