/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // For easier three.js development without double-mounting
  transpilePackages: ['three'],
};

export default nextConfig;
