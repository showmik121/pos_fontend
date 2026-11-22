import type { IconName } from "@/components/ui/icons"

export interface Feature {
  icon: IconName
  title: string
  body: string
}

export interface Step {
  title: string
  body: string
}

/** ল্যান্ডিং পাতার লেখা এক জায়গায়; শুধু অ্যাপে যা সত্যিই আছে তাই লেখা */
export const FEATURES: readonly Feature[] = [
  { icon: "receipt", title: "দ্রুত বিল", body: "পণ্য খুঁজে বা বারকোড স্ক্যান করে কয়েক সেকেন্ডে বিল। ক্যাশ, বিকাশ/নগদ বা বাকি — সব চলে।" },
  { icon: "calendar", title: "ব্যাচ ও মেয়াদ", body: "পুরনো ব্যাচ আগে বিক্রি হয়। মেয়াদোত্তীর্ণ ব্যাচ বিক্রি হয় না, মেয়াদ কাছে এলে আগেই চোখে পড়ে।" },
  { icon: "bell", title: "স্টক কমলে সতর্কতা", body: "কোন পণ্য ফুরিয়ে আসছে এক নজরে দেখুন, আগেই কিনে রাখুন।" },
  { icon: "book", title: "বাকির খাতা", body: "কার কাছে কত বাকি, কবে কত জমা নিলেন — হিসাব নিজে নিজেই মেলে।" },
  { icon: "chart", title: "বিক্রি ও লাভের রিপোর্ট", body: "দিনের বিক্রি, কীভাবে টাকা এলো আর কত লাভ হলো — মালিকের জন্য পরিষ্কার হিসাব।" },
  { icon: "users", title: "কর্মচারীর আলাদা লগইন", body: "কর্মচারী বিল করবে; রিপোর্ট আর কর্মচারী যোগ-বাদ থাকবে শুধু মালিকের হাতে।" },
]

export const STEPS: readonly Step[] = [
  { title: "দোকান খুলুন", body: "দোকানের নাম আর মোবাইল নম্বর দিন, ব্যস।" },
  { title: "পণ্য ও স্টক তুলুন", body: "একটা একটা করে বা CSV ফাইল থেকে একসাথে।" },
  { title: "বিল শুরু করুন", body: "প্রথম বিলেই হিসাব, স্টক আর বাকি নিজে নিজে হালনাগাদ।" },
]

export const HERO = {
  eyebrow: "ফার্মেসি · কসমেটিক্স · দোকান",
  title: "দোকানের হিসাব, এখন ফোনেই",
  lead: "বিক্রি, স্টক, মেয়াদ আর বাকির খাতা — বাংলায়, সহজে, ইন্টারনেট না থাকলেও।",
} as const

export const TRUST_POINTS = ["সম্পূর্ণ বাংলায়", "ব্রাউজার থেকেই ইনস্টল", "ইন্টারনেট ছাড়াও চলে"] as const

export interface InstallGuide {
  platform: string
  steps: readonly string[]
}

/** অ্যাপ স্টোর ছাড়া ব্রাউজার থেকে ইনস্টলের ধাপ (ব্রাউজারের নিজস্ব ইনস্টল বোতাম না এলেও এভাবে হয়) */
export const INSTALL_GUIDES: readonly InstallGuide[] = [
  { platform: "অ্যান্ড্রয়েড · Chrome", steps: ["Chrome-এ এই পাতা খুলুন", "ওপরের ডানে ⋮ মেনু চাপুন", "\"Install app\" বা \"Add to Home screen\" বেছে নিন"] },
  { platform: "আইফোন · Safari", steps: ["Safari-তে এই পাতা খুলুন", "নিচের শেয়ার (⬆) বোতাম চাপুন", "\"Add to Home Screen\" বেছে নিয়ে Add চাপুন"] },
]
