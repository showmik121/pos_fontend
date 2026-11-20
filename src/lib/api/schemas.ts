import { z } from "zod"

export const RoleSchema = z.enum(["owner", "staff"])
export const StoreKindSchema = z.enum(["pharmacy", "cosmetics", "other"])
export type StoreKind = z.infer<typeof StoreKindSchema>

export const UserSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  name: z.string(),
  phone: z.string(),
  role: RoleSchema,
  active: z.boolean(),
})
export type User = z.infer<typeof UserSchema>

/** প্ল্যাটফর্ম অপারেটর দোকানের যে অবস্থা বসায় (ব্যাকএন্ড `stores.status`); পুরনো সার্ভার না পাঠালে থাকে না */
export const StoreStatusSchema = z.enum(["trial", "active", "grace", "read_only", "suspended", "pending_deletion", "deleted", "cancelled"])
export type StoreStatus = z.infer<typeof StoreStatusSchema>

export const StoreSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: StoreKindSchema,
  status: StoreStatusSchema.optional(),
  /** অপারেটরের লেখা বার্তা, মালিককে দেখানোর জন্য (বাংলায়) */
  statusMessage: z.string().nullable().optional(),
})
export type Store = z.infer<typeof StoreSchema>

export const AuthResponseSchema = z.object({ token: z.string().min(1), user: UserSchema })
export const MeResponseSchema = z.object({ user: UserSchema, store: StoreSchema.nullable() })
export const StoreResponseSchema = z.object({ store: StoreSchema })
export const StaffListSchema = z.object({ staff: z.array(UserSchema) })
export const UserResponseSchema = z.object({ user: UserSchema })

export const ErrorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
})

/** অ্যাকাউন্টে অপারেটর কী করেছে: কখন, কোন অবস্থায়, কোন বার্তা; ভেতরের কারণ কখনো আসে না */
export const AccountActivitySchema = z.object({
  activity: z.array(z.object({ at: z.string(), status: StoreStatusSchema, message: z.string().nullable() })),
})
export type AccountActivity = z.infer<typeof AccountActivitySchema>["activity"]

export const DeviceResponseSchema = z.object({ code: z.string().regex(/^[A-Z]$/) })

export const PushResponseSchema = z.object({ accepted: z.array(z.string()) })
export const PullResponseSchema = z.object({
  events: z.array(z.looseObject({ seq: z.number() })),
  lastSeq: z.number(),
  hasMore: z.boolean(),
})
