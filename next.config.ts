import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Canonical domain: https://www.qerbie.com
    // Consolidate indexing and avoid duplicate content across apex and www.
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "header",
            key: "host",
            value: "qerbie.com",
          },
        ],
        destination: "https://www.qerbie.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
