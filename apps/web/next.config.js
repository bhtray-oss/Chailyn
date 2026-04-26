/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // @freesewing/react 需要 'use client' 邊界
    serverComponentsExternalPackages: ['@freesewing/core', '@freesewing/react'],
    // Fix pnpm workspace symlink snapshot warning
    outputFileTracingRoot: require('path').join(__dirname, '../../'),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'chailyn.app' },
    ],
  },
}

module.exports = nextConfig
