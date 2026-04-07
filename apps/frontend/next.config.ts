import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion", "@radix-ui/react-icons"],
  },
};

export default nextConfig;


