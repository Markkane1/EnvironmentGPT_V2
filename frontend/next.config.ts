import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";
import { getConfiguredBackendUrl } from "./src/lib/runtime-config";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(configDir, "..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  reactStrictMode: false,
  turbopack: {
    root: workspaceRoot,
  },
  async rewrites() {
    const backendUrl = getConfiguredBackendUrl(process.env);
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
