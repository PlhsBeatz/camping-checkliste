/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Verbesserte PWA-Konfiguration für Next.js 15
  sw: 'sw.js',
  reloadOnOnline: true,
  scope: '/',
});

const nextConfig = {
  // React Strict Mode für Entwicklung
  reactStrictMode: true,
  
  // Image-Optimierung
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Experimental Features für Next.js 15
  experimental: {
    // Optimierte Package Imports
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'lucide-react',
    ],
  },
};

module.exports = withPWA(nextConfig);
