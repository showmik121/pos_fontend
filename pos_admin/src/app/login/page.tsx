"use client"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState, type FormEvent } from "react"
import { btnCls, btnPrimaryCls, ErrorNote, Field, inputCls } from "@/components/ui"
import { QrCode } from "@/components/qr-code"
import { call, friendlyError } from "@/lib/api"
import { useSession } from "@/lib/session"

type Admin = Parameters<ReturnType<typeof useSession>["start"]>[1]
type Step =
  | { kind: "credentials" }
  | { kind: "code"; pending: string; recovery: boolean }
  | { kind: "enroll"; pending: string; secret: string | null; uri: string | null }
  | { kind: "recovery-codes"; codes: string[]; token: string; admin: Admin }

function SignIn() {
  const router = useRouter()
  const params = useSearchParams()
  const { start } = useSession()
  const [step, setStep] = useState<Step>({ kind: "credentials" })
  const [error, setError] = useState<string | null>(params.get("expired") ? "Your session ended. Sign in again." : null)
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  function onCredentials(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    void run(async () => {
      const r = await call("auth.login", { input: { email: String(f.get("email")), password: String(f.get("password")) } })
      setStep(r.stage === "enroll" ? { kind: "enroll", pending: r.pendingToken, secret: null, uri: null } : { kind: "code", pending: r.pendingToken, recovery: false })
    })
  }

  function onCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (step.kind !== "code") return
    const f = new FormData(e.currentTarget)
    const value = String(f.get("code")).trim()
    void run(async () => {
      const r = await call("auth.2fa", { tokenOverride: step.pending, input: step.recovery ? { recoveryCode: value } : { code: value } })
      start(r.token, r.admin)
      router.replace("/dashboard/")
    })
  }

  function beginEnroll() {
    if (step.kind !== "enroll") return
    const pending = step.pending
    void run(async () => {
      const r = await call("auth.enroll-start", { tokenOverride: pending })
      setStep({ kind: "enroll", pending, secret: r.secret, uri: r.otpauthUri })
    })
  }

  function onEnrollConfirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (step.kind !== "enroll") return
    const pending = step.pending
    const code = String(new FormData(e.currentTarget).get("code")).trim()
    void run(async () => {
      const r = await call("auth.enroll-confirm", { tokenOverride: pending, input: { code } })
      setStep({ kind: "recovery-codes", codes: r.recoveryCodes, token: r.token, admin: r.admin })
    })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-4">
      <h1 className="text-xl font-semibold">Bipone Admin</h1>
      <ErrorNote message={error} />

      {step.kind === "credentials" && (
        <form onSubmit={onCredentials} className="flex flex-col gap-4">
          <Field label="Email">{(id) => <input id={id} name="email" type="email" autoComplete="username" required className={inputCls} />}</Field>
          <Field label="Password">{(id) => <input id={id} name="password" type="password" autoComplete="current-password" required className={inputCls} />}</Field>
          <button type="submit" disabled={busy} className={btnPrimaryCls}>
            {busy ? "Signing in…" : "Continue"}
          </button>
        </form>
      )}

      {step.kind === "code" && (
        <form onSubmit={onCode} className="flex flex-col gap-4">
          <Field label={step.recovery ? "Recovery code" : "6-digit code from your authenticator"}>
            {(id) => <input id={id} name="code" autoComplete="one-time-code" inputMode={step.recovery ? "text" : "numeric"} required autoFocus className={inputCls} />}
          </Field>
          <button type="submit" disabled={busy} className={btnPrimaryCls}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button type="button" className={btnCls} onClick={() => setStep({ ...step, recovery: !step.recovery })}>
            {step.recovery ? "Use authenticator code instead" : "Use a recovery code instead"}
          </button>
        </form>
      )}

      {step.kind === "enroll" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm">Two-factor sign-in is required. Add this account to an authenticator app, then enter the 6-digit code.</p>
          {step.secret && step.uri ? (
            <>
              <div className="flex flex-col items-center gap-2">
                <QrCode value={step.uri} label="QR code to add this account to your authenticator app" />
                <p className="text-center text-xs text-[var(--muted)]">Scan this with your authenticator app (Google Authenticator, Microsoft Authenticator, Authy…).</p>
              </div>
              <p className="text-sm">
                Can’t scan? Enter this setup key instead: <code className="break-all font-mono">{step.secret}</code>
              </p>
              <p className="break-all text-xs text-[var(--muted)]">Or open this link on the device with your authenticator: {step.uri}</p>
              <form onSubmit={onEnrollConfirm} className="flex flex-col gap-4">
                <Field label="6-digit code">{(id) => <input id={id} name="code" inputMode="numeric" autoComplete="one-time-code" required className={inputCls} />}</Field>
                <button type="submit" disabled={busy} className={btnPrimaryCls}>
                  {busy ? "Checking…" : "Confirm"}
                </button>
              </form>
            </>
          ) : (
            <button type="button" disabled={busy} className={btnPrimaryCls} onClick={beginEnroll}>
              Start setup
            </button>
          )}
        </div>
      )}

      {step.kind === "recovery-codes" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">Save these recovery codes now. They are shown once and each works one time if you lose your authenticator.</p>
          <ul className="grid grid-cols-2 gap-1 font-mono text-sm" aria-label="Recovery codes">
            {step.codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button
            type="button"
            className={btnPrimaryCls}
            onClick={() => {
              start(step.token, step.admin)
              router.replace("/dashboard/")
            }}
          >
            I have saved them
          </button>
        </div>
      )}
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Loading…</p>}>
      <SignIn />
    </Suspense>
  )
}
