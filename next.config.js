/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // PWA vorerst DEAKTIVIEREN, auch in Production, um Cache-Probleme zu lösen
  disable: true, 
  sw: 'sw.js',
  reloadOnOnline: true,
  scope: '/',
});

const nextConfig = {
  // React Strict Mode
  reactStrictMode: true,
  
  // WICHTIG FÜR CLOUDFLARE PAGES:
  // Wir deaktivieren die Next.js Bildoptimierung, da sie auf Pages 
  // ohne spezielle Worker-Konfiguration zu Abstürzen führt.
  images: {
    unoptimized: true, 
  },
  
  // Experimental Features für Next.js 15
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'lucide-react',
    ],
  },
};

module.exports = withPWA(nextConfig);
