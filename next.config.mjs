import withSerwistInit from '@serwist/next';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// .dev.vars (Wrangler) optional laden, damit "pnpm dev" dieselben Env-Vars wie Cloudflare hat
function loadDevVars() {
  const path = join(process.cwd(), '.dev.vars');
  if (!existsSync(path)) return {};
  const content = readFileSync(path, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return env;
}

const devVars = loadDevVars();

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  register: false,
  additionalPrecacheEntries: [{ url: '/~offline', revision: Date.now().toString() }],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
};

export default withSerwist(nextConfig);
