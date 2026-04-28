/** @type {import('next').NextConfig} */
const isCapacitor = process.env.BUILD_TARGET === 'capacitor'

const nextConfig = {
  reactStrictMode: true,
  // 靜態匯出（Capacitor 離線包殼用）：BUILD_TARGET=capacitor pnpm build
  ...(isCapacitor && { output: 'export', images: { unoptimized: true } }),
  experimental: {
    // @freesewing/react 需要 'use client' 邊界
    serverComponentsExternalPackages: [
      '@freesewing/core', '@freesewing/react',
      '@freesewing/aaron', '@freesewing/bella', '@freesewing/bibi',
      '@freesewing/brian', '@freesewing/carlita', '@freesewing/carlton',
      '@freesewing/huey', '@freesewing/lily', '@freesewing/paco',
      '@freesewing/sandy', '@freesewing/simon', '@freesewing/simone',
      '@freesewing/teagan', '@freesewing/titan', '@freesewing/waralee',
      '@freesewing/plugin-theme', '@freesewing/plugin-transform',
      '@freesewing/models', '@anthropic-ai/sdk',
    ],
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
