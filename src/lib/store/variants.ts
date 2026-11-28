import { tr } from "../i18n"
import { DomainError } from "../domain/errors"
import { VARIANT_TEXT_MAX, type Db, type Product } from "./types"

/** পণ্যের পুরো নাম: "Ponds Cream · ৫০ml" */
export function variantName(family: string, variant: string): string {
  return `${family.trim()} · ${variant.trim()}`
}

/** ফ্যামিলির মেলানোর চাবি; ভ্যারিয়েন্ট না থাকলে null (সাধারণ পণ্য কারো সাথে বাঁধা নয়) */
export function familyKey(p: Pick<Product, "family" | "variant">): string | null {
  if (!p.variant?.trim() || !p.family?.trim()) return null
  return p.family.trim().toLowerCase()
}

/** ইনপুটের নাম + ঐচ্ছিক ভ্যারিয়েন্ট থেকে পণ্যের `name`/`family`/`variant` বানায়; ভ্যারিয়েন্ট ফাঁকা হলে নাম যেমন ছিল তেমন */
export function resolveVariant(input: { name: string; variant?: string }): Pick<Product, "name" | "family" | "variant"> {
  const family = input.name.trim()
  const variant = input.variant?.trim() ?? ""
  if (!variant) return { name: family }
  if (family.length > VARIANT_TEXT_MAX.family) throw new DomainError("family_too_long", tr("পণ্যের নাম বেশি লম্বা"))
  if (variant.length > VARIANT_TEXT_MAX.variant) throw new DomainError("variant_too_long", tr("ভ্যারিয়েন্ট বেশি লম্বা (যেমন ৫০ml)"))
  return { name: variantName(family, variant), family, variant }
}

/** একই ফ্যামিলির অন্য ভ্যারিয়েন্টগুলো (নিজেকে বাদে), লেবেল অনুযায়ী সাজানো */
export function siblingsOf(db: Db, p: Product): Product[] {
  const key = familyKey(p)
  if (!key) return []
  return db.products.filter((x) => x.id !== p.id && familyKey(x) === key).sort((a, b) => (a.variant ?? "").localeCompare(b.variant ?? "", "bn", { numeric: true }))
}

/** একই ফ্যামিলি+ভ্যারিয়েন্ট আগে থেকে আছে কি (`exceptId` বাদে) */
export function hasVariant(db: Db, family: string, variant: string, exceptId?: string): boolean {
  const key = family.trim().toLowerCase()
  const v = variant.trim().toLowerCase()
  return db.products.some((x) => x.id !== exceptId && familyKey(x) === key && (x.variant ?? "").trim().toLowerCase() === v)
}

export interface ProductGroup {
  /** ফ্যামিলি চাবি, বা সাধারণ পণ্যে পণ্যের id */
  key: string
  /** ফ্যামিলির নাম (সাধারণ পণ্যে পণ্যের নাম) */
  title: string
  items: Product[]
}

/** তালিকার ক্রম ধরে ভ্যারিয়েন্টগুলোকে ফ্যামিলির প্রথম পণ্যের জায়গায় এক গ্রুপে জড়ো করে; ভ্যারিয়েন্ট-ছাড়া পণ্য একা গ্রুপ */
export function groupByFamily(products: Product[]): ProductGroup[] {
  const groups: ProductGroup[] = []
  const byKey = new Map<string, ProductGroup>()
  for (const p of products) {
    const key = familyKey(p)
    if (!key) {
      groups.push({ key: p.id, title: p.name, items: [p] })
      continue
    }
    const existing = byKey.get(key)
    if (existing) existing.items.push(p)
    else {
      const g: ProductGroup = { key: `family:${key}`, title: p.family ?? p.name, items: [p] }
      byKey.set(key, g)
      groups.push(g)
    }
  }
  return groups
}
