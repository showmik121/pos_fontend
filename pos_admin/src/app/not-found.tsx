import Link from "next/link"

// Our own 404: Next's built-in one ships inline styles, which the strict CSP (no 'unsafe-inline' styles) would block.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 px-4">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-[var(--muted)]">That page does not exist.</p>
      <Link href="/tenants/" className="text-sm text-[var(--brand)] underline">
        Go to shops
      </Link>
    </main>
  )
}
