import withSerwistInit from '@serwist/next';
import { loadDevVars } from './dev-vars-node.mjs';

/**
 * Lokales `pnpm dev`: Wrangler `getPlatformProxy` stellt Bindings bereit (u.a. D1 `DB`).
 * Top-level await: Init muss fertig sein, bevor der Dev-Server Anfragen annimmt (sonst fehlt `DB`).
 */
if (process.argv.includes('dev')) {
  try {
    const { initOpenNextCloudflareForDev } = await import('@opennextjs/cloudflare');
    await initOpenNextCloudflareForDev();
  } catch (err) {
    console.error('[OpenNext] Cloudflare-Dev-Init fehlgeschlagen:', err);
  }
}

/** Für Next `env:`; echtes `process.env` setzt `pnpm dev` via `scripts/next-dev.mjs` + `.dev.vars`. */
const devVars = loadDevVars();

// Häufig genutzte Top-Level-Routen, die wir aktiv precachen wollen, damit die installierte
// PWA auch beim ersten Cold-Start offline brauchbar ist (HTML-Shell aus dem Precache,
// die eigentlichen Daten kommen aus IndexedDB).
const swRevision = Date.now().toString();
const additionalPrecacheEntries = [
  '/~offline',
  '/',
  '/pack-status',
  '/urlaube',
  '/ausruestung',
  '/kategorien',
  '/tags',
  '/mitreisende',
  '/transportmittel',
  '/campingplaetze',
  '/profil',
  '/tools/sonnen-ausrichtung',
  '/tools/checklisten',
  '/manifest.json',
].map((url) => ({ url, revision: swRevision }));

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  register: false,
  additionalPrecacheEntries,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: { ...devVars },
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'lucide-react',
    ],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
  async rewrites() {
    // Viele Browser laden standardmäßig /favicon.ico; die echte Marke liegt als SVG vor.
    return [{ source: '/favicon.ico', destination: '/icon.svg' }];
  },
};

export default withSerwist(nextConfig);
