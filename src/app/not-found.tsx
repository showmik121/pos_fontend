import Link from "next/link"

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-dvh max-w-(--app-col) place-content-center gap-3 p-6 text-center">
      <p className="text-lg font-bold">পাতাটি পাওয়া যায়নি</p>
      <Link href="/" className="font-medium text-brand">
        হোমে ফিরুন
      </Link>
    </div>
  )
}
