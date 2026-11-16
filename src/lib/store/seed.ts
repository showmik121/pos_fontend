import { addDays, localDateIso } from "../domain/dates"
import { newId } from "./db"
import type { Batch, Customer, Db, LedgerEntry, Product, UnitLabel } from "./types"

interface DemoProduct {
  name: string
  price: number
  cost: number
  unit: UnitLabel
  carton: number
  category: string
  min: number
  batches: Array<{ no: string; expiryInDays: number | null; qty: number }>
}

const DEMO: DemoProduct[] = [
  { name: "পন্ডস ক্রিম ১০০ মি.লি.", price: 240, cost: 200, unit: "piece", carton: 10, category: "স্কিন কেয়ার", min: 5, batches: [{ no: "B2406", expiryInDays: 480, qty: 4 }, { no: "B2407", expiryInDays: 600, qty: 10 }] },
  { name: "নাপা এক্সট্রা (পাতা)", price: 25, cost: 20, unit: "strip", carton: 1, category: "ওষুধ", min: 50, batches: [{ no: "N2311", expiryInDays: 18, qty: 40 }, { no: "N2402", expiryInDays: 400, qty: 220 }] },
  { name: "ডেটল সাবান ১২৫ গ্রাম", price: 55, cost: 45, unit: "piece", carton: 12, category: "সাবান", min: 5, batches: [{ no: "D2403", expiryInDays: null, qty: 2 }] },
  { name: "সেকলো ২০ (বক্স)", price: 120, cost: 100, unit: "box", carton: 1, category: "ওষুধ", min: 5, batches: [{ no: "B2310", expiryInDays: -12, qty: 12 }, { no: "B2405", expiryInDays: 500, qty: 20 }] },
  { name: "ওরস্যালাইন", price: 10, cost: 7, unit: "piece", carton: 100, category: "ওষুধ", min: 30, batches: [{ no: "O2401", expiryInDays: 18, qty: 25 }, { no: "O2404", expiryInDays: 365, qty: 55 }] },
  { name: "ভ্যাসলিন ৫০ মি.লি.", price: 90, cost: 72, unit: "piece", carton: 12, category: "স্কিন কেয়ার", min: 5, batches: [{ no: "V2402", expiryInDays: 18, qty: 3 }] },
  { name: "নিভিয়া লোশন ২০০ মি.লি.", price: 380, cost: 320, unit: "piece", carton: 6, category: "স্কিন কেয়ার", min: 5, batches: [{ no: "L2404", expiryInDays: 48, qty: 8 }, { no: "L2410", expiryInDays: 700, qty: 14 }] },
  { name: "পন্ডস ফেসওয়াশ ১০০ গ্রাম", price: 210, cost: 170, unit: "piece", carton: 12, category: "স্কিন কেয়ার", min: 5, batches: [{ no: "F2405", expiryInDays: 80, qty: 15 }] },
]

const DEMO_CUSTOMERS: Array<{ name: string; phone: string; due: number }> = [
  { name: "রহিম উদ্দিন", phone: "01711000000", due: 2500 },
  { name: "সালমা বেগম", phone: "01811000000", due: 1800 },
  { name: "করিম মিয়া", phone: "01911000000", due: 1200 },
]

/** নমুনা পণ্য, ব্যাচ ও বাকির খাতা যোগ করে (আগের তথ্য ঠিক রেখে)। শুধু দেখার/পরীক্ষার জন্য। */
export function withDemoData(db: Db, now: Date): Db {
  const today = localDateIso(now)
  const nowIso = now.toISOString()
  const products: Product[] = []
  const batches: Batch[] = []
  DEMO.forEach((d, i) => {
    const id = newId()
    products.push({
      id,
      name: d.name,
      barcodes: [{ code: String(8901000000000 + i * 7 + 11), packSize: 1 }],
      unit: d.unit,
      cartonSize: d.carton,
      costPoisha: d.cost * 100,
      pricePoisha: d.price * 100,
      minStock: d.min,
      category: d.category,
      open: false,
      createdAt: nowIso,
    })
    for (const b of d.batches) {
      batches.push({
        id: newId(),
        productId: id,
        batchNo: b.no,
        expiryDate: b.expiryInDays == null ? null : addDays(today, b.expiryInDays),
        qtyRemaining: b.qty,
        costPoisha: d.cost * 100,
        receivedAt: nowIso,
      })
    }
  })
  const customers: Customer[] = []
  const ledger: LedgerEntry[] = []
  for (const c of DEMO_CUSTOMERS) {
    const id = newId()
    customers.push({ id, name: c.name, phone: c.phone, createdAt: nowIso })
    ledger.push({ id: newId(), customerId: id, at: nowIso, kind: "opening", amount: c.due * 100, saleNo: null, by: "নমুনা" })
  }
  return { ...db, products: [...db.products, ...products], batches: [...db.batches, ...batches], customers: [...db.customers, ...customers], ledger: [...db.ledger, ...ledger] }
}
