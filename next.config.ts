import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_TEST_CATALOG: process.env.VERCEL !== "1" && process.env.NEXT_PUBLIC_TEST_CATALOG === "1" ? "1" : "0",
  },
};

export default nextConfig;
