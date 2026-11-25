/**
 * বাংলা ও ইংরেজি বানান মেলানোর মোটামুটি "কঙ্কাল" চাবি: স্বরবর্ণ বাদ, কাছাকাছি ধ্বনি এক অক্ষরে।
 * যেমন Paracetamol ও প্যারাসিটামল দুটোই "prstml" হয়। শুধু সার্চের সুবিধার জন্য; কোনো তথ্য বদলায় না।
 * ভুল মিল হতে পারে, তাই সরাসরি মিলই আগে দেখানো হয় (search.ts)।
 */

const BN: Record<string, string> = {
  ক: "k", খ: "k", গ: "g", ঘ: "g", ঙ: "n", চ: "c", ছ: "c", জ: "j", ঝ: "j", ঞ: "n",
  ট: "t", ঠ: "t", ড: "d", ঢ: "d", ণ: "n", ত: "t", থ: "t", দ: "d", ধ: "d", ন: "n",
  প: "p", ফ: "f", ব: "b", ভ: "b", ম: "m", র: "r", ল: "l", শ: "s", ষ: "s", স: "s",
  ড়: "r", ঢ়: "r", ৎ: "t",
}

/** য়/য/হ/স্বরচিহ্ন/হসন্ত/চন্দ্রবিন্দু ইত্যাদি বাদ যায় (BN-এ নেই বলে) */
function bnKey(ch: string): string {
  return BN[ch] ?? ""
}

export function phoneticKey(input: string): string {
  // ড় ঢ় যুক্ত হরফ (ড + ়) আগে একক হরফে আনা
  const text = input.normalize("NFC").replace(/ড়/g, "ড়").replace(/ঢ়/g, "ঢ়").toLowerCase()
  let out = ""
  const push = (c: string) => {
    if (c && out[out.length - 1] !== c) out += c
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? ""
    const next = text[i + 1] ?? ""
    if (ch >= "ঀ" && ch <= "৿") {
      push(bnKey(ch))
      continue
    }
    if (ch < "a" || ch > "z") continue
    const two = ch + next
    if (two === "th" || two === "dh") {
      push(ch)
      i++
    } else if (two === "kh") {
      push("k")
      i++
    } else if (two === "gh") {
      push("g")
      i++
    } else if (two === "ph") {
      push("f")
      i++
    } else if (two === "sh") {
      push("s")
      i++
    } else if (two === "ch") {
      push("c")
      i++
    } else if (ch === "c") push("eiy".includes(next) && next !== "" ? "s" : "k")
    else if (ch === "q") push("k")
    else if (ch === "x") {
      push("k")
      push("s")
    } else if (ch === "z") push("j")
    else if (ch === "v") push("b")
    else if ("bdfgjklmnprst".includes(ch)) push(ch)
    // a e i o u y w h — বাদ
  }
  return out
}
