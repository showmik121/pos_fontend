// Static export: the admin panel is plain files behind Cloudflare Access / an IP allow-list (PRD Q9), no server of its own.
/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
}

export default config
