import { z } from "zod"

/**
 * সার্ভার থেকে আসা ইভেন্টের পেলোডের আকার-যাচাই। সার্ভার শুধু খামটি দেখে, ভেতরের বিষয়বস্তু দেখে না;
 * তাই অন্য ডিভাইস/কর্মচারী বা নষ্ট ডেটা একটি বিকৃত ইভেন্ট দিয়ে সবার সিংক থামিয়ে দিতে পারত।
 *
 * এগুলো শুধু "গ্রহণযোগ্য কি না" ঠিক করে; ডেটা বদলায় না (`safeParse().success` দেখা হয়, ফল নয়),
 * তাই অচেনা নতুন ফিল্ড (ভবিষ্যৎ সংস্করণ) অক্ষত থাকে। ফিল্ড-সীমা পেলোডের ৪০ KB সীমার ওপর অতিরিক্ত বাঁধ।
 */

const id = z.string().min(1).max(200)
const text = (max: number) => z.string().max(max)
const poisha = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const nullableText = (max: number) => z.string().max(max).nullable()

const barcode = z.looseObject({ code: z.string().min(1).max(500), packSize: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER) })

export const productSchema = z.looseObject({
  id,
  name: z.string().min(1).max(300),
  barcodes: z.array(barcode).max(50),
  unit: z.enum(["piece", "strip", "box"]),
  cartonSize: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  costPoisha: poisha,
  pricePoisha: poisha,
  minStock: count,
  category: text(2000),
  // ফার্মেসির ঐচ্ছিক ঘর (পুরনো ডেটা ও অন্য ডিভাইসে নেই)
  stripSize: z.number().int().min(2).max(Number.MAX_SAFE_INTEGER).optional(),
  generic: text(300).optional(),
  strength: text(100).optional(),
  form: z.enum(["tablet", "capsule", "syrup", "injection", "drop", "cream", "inhaler", "saline", "other"]).optional(),
  company: text(300).optional(),
  open: z.boolean(),
  createdAt: text(40),
})

export const customerSchema = z.looseObject({
  id,
  name: z.string().min(1).max(300),
  phone: text(40),
  createdAt: text(40),
})

const allocationSchema = z.looseObject({ batchId: id, batchNo: text(2000), qty: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), costPoisha: poisha })

const saleLineSchema = z.looseObject({
  productId: id,
  name: text(2000),
  qty: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  unitPrice: poisha,
  discount: poisha,
  allocations: z.array(allocationSchema).max(200),
})

export const saleSchema = z.looseObject({
  id,
  no: count,
  prefix: z.string().max(4).optional(),
  at: text(40),
  cashier: text(2000),
  lines: z.array(saleLineSchema).max(500),
  subtotal: poisha,
  lineDiscount: poisha,
  billDiscount: poisha,
  total: poisha,
  payments: z.array(z.looseObject({ method: text(20), amount: poisha })).max(10),
  change: poisha,
  due: poisha,
  customerId: nullableText(200),
  customerName: nullableText(300),
  voided: z.looseObject({ at: text(40), by: text(2000), reason: text(2000) }).optional(),
})

export const ledgerEntrySchema = z.looseObject({
  id,
  customerId: id,
  at: text(40),
  kind: text(20),
  amount: poisha,
  saleNo: count.nullable(),
  salePrefix: z.string().max(4).optional(),
  by: text(2000),
})

export const removedBatchSchema = z.looseObject({
  id,
  at: text(40),
  by: text(2000),
  batchId: id.optional(),
  productId: id,
  productName: text(2000),
  batchNo: text(2000),
  expiryDate: nullableText(20),
  qty: count,
  costPoisha: poisha,
  reason: text(2000),
})

export const settingsSchema = z.looseObject({
  expiryDays: z.array(z.number().int().min(1).max(3650)).max(10),
  defaultMinStock: count,
})

/** আকার ঠিক থাকলে true; ভুল হলে ইভেন্ট বাদ (ignored) যাবে */
export const accepts = (schema: z.ZodType, value: unknown): boolean => schema.safeParse(value).success
