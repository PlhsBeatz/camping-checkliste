import { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig

// import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"
// initOpenNextCloudflareForDev()
