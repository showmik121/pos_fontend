// পুরো অ্যাপ ক্লায়েন্ট-সাইড: স্ট্যাটিক export করে যেকোনো সস্তা স্ট্যাটিক হোস্টে চালানো যায়।
/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
}

export default config
