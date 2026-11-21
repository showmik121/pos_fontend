// Static export: the admin panel is plain files behind Cloudflare Access / an IP allow-list (PRD Q9), no server of its own.
/** @type {import('next').NextConfig} */
// ADMIN_BASE_PATH=/admin when the panel is served under the shop site's domain (scripts/embed-admin.mjs); empty (root) for dev, e2e and a separate host.
const basePath = process.env.ADMIN_BASE_PATH ?? ""

const config = {
  ...(basePath ? { basePath } : {}),
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
}

export default config
