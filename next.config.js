/** @type {import('next').NextConfig} */
// output standalone hanya untuk Docker; Vercel memakai build bawaan (Turbopack)
const IS_VERCEL = process.env.VERCEL === "1";

module.exports = {
  output: IS_VERCEL ? undefined : "standalone",
  reactStrictMode: true,
  images: {
    domains: [],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/src/login.html",
        permanent: false,
      },
    ];
  },
}