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

export const StoreSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: StoreKindSchema,
})
export type Store = z.infer<typeof StoreSchema>

export const AuthResponseSchema = z.object({ token: z.string().min(1), user: UserSchema })
export const MeResponseSchema = z.object({ user: UserSchema, store: StoreSchema.nullable() })
export const StaffListSchema = z.object({ staff: z.array(UserSchema) })
export const UserResponseSchema = z.object({ user: UserSchema })

export const ErrorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
})

export const DeviceResponseSchema = z.object({ code: z.string().regex(/^[A-Z]$/) })
