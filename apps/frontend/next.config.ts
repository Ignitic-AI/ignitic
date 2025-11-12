import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

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

    // Disable dynamic chunk splitting to prevent missing .js chunks
    config.optimization.splitChunks = false;
    config.output.chunkFilename = "[name].js";

    return config;
  },
};

export default nextConfig;


