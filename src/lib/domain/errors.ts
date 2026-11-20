import { tr, tf } from "../i18n"
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = "DomainError"
  }
}

export function requirePositiveInt(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError("invalid_number", tf("{p0} সঠিক নয়", { p0: tr(name) }))
  }
  return value
}

export function requireNonNegativeInt(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new DomainError("invalid_number", tf("{p0} সঠিক নয়", { p0: tr(name) }))
  }
  return value
}

/** ফর্মে দেখানোর জন্য যেকোনো ত্রুটিকে বাংলা বার্তায় বদলায়। */
export function domainMessage(err: unknown): string {
  return err instanceof DomainError ? err.message : tr("কিছু একটা ভুল হয়েছে, আবার চেষ্টা করুন")
}
