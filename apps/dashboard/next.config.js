/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@visionguard/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
};

module.exports = nextConfig;
