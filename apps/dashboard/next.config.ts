import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow importing TS source from workspace packages without a pre-build step.
  transpilePackages: ["@mahmulp/feedback-sdk", "@mahmulp/shared-types"],
};

export default nextConfig;
