import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  
  // Reduce unnecessary logging in production
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
};

export default nextConfig;
