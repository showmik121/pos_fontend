import { z } from "zod"
import { StoreSchema, UserSchema } from "../api/schemas"

const KEY = "pos.session.v1"

export const SessionSchema = z.object({
  token: z.string().min(1),
  user: UserSchema,
  store: StoreSchema.nullable(),
})
export type Session = z.infer<typeof SessionSchema>

// localStorage প্রাইভেট মোড/ব্লকড অবস্থায় ছুঁড়তে পারে, তাই সবখানে try/catch
export function loadSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = SessionSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function saveSession(session: Session): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // সেভ না হলে এই ট্যাবে চলবে, রিলোডে আবার লগইন লাগবে
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // উপেক্ষা
  }
}
