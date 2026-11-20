import { tr } from "@/lib/i18n"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-dvh max-w-(--app-col) place-content-center gap-3 p-6 text-center">
      <p className="text-lg font-bold">{tr("পাতাটি পাওয়া যায়নি")}</p>
      <Link href="/" className="font-medium text-brand">
        {tr("হোমে ফিরুন")}
      </Link>
    </div>
  )
}
