import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,

  /* config options here */
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: [
          // Add problematic files
          "**/pagefile.sys",
          "**/hiberfil.sys",
        ],
      };
    }

    return config;
  },
};

export default nextConfig;


