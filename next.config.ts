import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 writes an AGENTS.md on dev start; we keep our own docs.
  agentRules: false,

  // Self-hosted: run with `next start` inside the container (see Dockerfile)
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,

  // Performance: Optimize package imports to reduce bundle size
  experimental: {
    optimizePackageImports: [
      'date-fns',
      'katex', 
      'mathjs',
      'lucide-react',
    ],
  },
  
  // Performance: Keep heavy server-only packages out of client bundle
  serverExternalPackages: [
    'googleapis',
    'pdf-lib',
    'openai',
    'nodemailer',
    'resend',
  ],
  
  // Performance: Enable compression and optimize images
  compress: true,
  poweredByHeader: false,

  // Baseline security headers; the CSP is set per request in src/proxy.ts
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ],
    }]
  },
  
  // Reduce unnecessary logging in production
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
};

export default nextConfig;
