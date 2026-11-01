import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // أخطاء TypeScript توقف البناء. لتجاوزها مؤقتًا فقط: IGNORE_TS_ERRORS=1
    ignoreBuildErrors: process.env.IGNORE_TS_ERRORS === "1",
  },
  reactStrictMode: false,
};

export default nextConfig;
