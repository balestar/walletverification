import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Optional Privy features we don't use — stub them out to keep builds clean.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@farcaster/mini-app-solana": false,
      "@stripe/crypto": false,
      "@stripe/react-connect-js": false,
    };
    return config;
  },
};

export default nextConfig;
