// পুরো অ্যাপ ক্লায়েন্ট-সাইড: স্ট্যাটিক export করে যেকোনো সস্তা স্ট্যাটিক হোস্টে চালানো যায়।
/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  // ক্র্যাশ রিপোর্টে কোন সংস্করণ ভেঙেছে জানতে (Netlify/GitHub বিল্ডের কমিট)
  env: { NEXT_PUBLIC_APP_VERSION: (process.env.COMMIT_REF || process.env.GITHUB_SHA || "dev").slice(0, 7) },
}

export default config
