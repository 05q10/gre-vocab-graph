import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['onnxruntime-node', 'sharp'],
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/onnxruntime-node/bin/napi-v3/linux/x64/**/*'],
  },
};

export default nextConfig;
