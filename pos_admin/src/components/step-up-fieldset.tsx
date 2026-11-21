"use client"
import { Field, inputCls } from "@/components/ui"

/** Password + fresh 2FA code, shown only while the 5-minute step-up window is closed (same wording as the status dialog). */
export function StepUpFieldset() {
  return (
    <fieldset className="flex flex-col gap-3 rounded border border-[var(--line)] p-3">
      <legend className="px-1 text-sm font-medium">Confirm it is you</legend>
      <Field label="Your password">{(id) => <input id={id} name="password" type="password" autoComplete="current-password" required className={inputCls} />}</Field>
      <Field label="6-digit code (a fresh one)">{(id) => <input id={id} name="code" inputMode="numeric" autoComplete="one-time-code" required className={inputCls} />}</Field>
    </fieldset>
  )
}
