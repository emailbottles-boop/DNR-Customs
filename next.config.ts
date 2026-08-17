import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Printful serves product mockups and previews from these hosts. Anything
    // else is rejected by the optimizer, which is the point of the allowlist.
    remotePatterns: [
      { protocol: "https", hostname: "files.cdn.printful.com" },
      { protocol: "https", hostname: "printful-upload.s3-accelerate.amazonaws.com" },
    ],
  },
};

export default nextConfig;
