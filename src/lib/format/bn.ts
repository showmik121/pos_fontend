const BN = "০১২৩৪৫৬৭৮৯"

/** ইংরেজি অঙ্ক (0–9) কে বাংলা অঙ্কে বদলায়; স্ক্রিনে দেখানোর জন্য। */
export function toBanglaDigits(input: unknown): string {
  return String(input).replace(/[0-9]/g, (d) => BN[Number(d)] ?? d)
}

/** বাংলা অঙ্ক (০–৯) কে ইংরেজিতে বদলায়; API-তে পাঠানোর আগে। */
export function toAsciiDigits(input: unknown): string {
  return String(input).replace(/[০-৯]/g, (d) => String(BN.indexOf(d)))
}
