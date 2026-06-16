import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@kiroportal/ui', '@kiroportal/types'],

  // Ignore ESLint errors during builds (warnings shouldn't block)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Ignore TypeScript errors during builds (dev handles these)
  typescript: {
    ignoreBuildErrors: true,
  },

  // ISR default revalidation interval (10 minutes)
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 600,
    },
  },

  // Image optimization: allow S3/MinIO image domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'placeholder.kiroportal.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
      },
      {
        protocol: 'http',
        hostname: 'minio',
        port: '9000',
      },
    ],
  },

  // API proxy: rewrite /api/* to backend
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
