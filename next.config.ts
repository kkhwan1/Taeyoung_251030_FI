import type { NextConfig } from "next";
import type { Configuration } from 'webpack';

const nextConfig: NextConfig = {
  // Disable React Strict Mode to fix Hydration Mismatch issues
  reactStrictMode: false,

  // ESLint configuration
  eslint: {
    // Temporarily ignore ESLint errors during builds
    ignoreDuringBuilds: true,
  },

  // TypeScript configuration
  typescript: {
    // Temporarily ignore TypeScript errors during builds
    ignoreBuildErrors: true,
  },

  // Compiler options
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pybjnkbmtlyaftuiieyq.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Compression settings
  compress: true,

  // Power pack settings for better performance
  poweredByHeader: false,

  // Bundle analyzer is now integrated in the main webpack config

  // Experimental features
  experimental: {
    // Enable modern bundling optimizations
    optimizePackageImports: ['lucide-react', 'recharts'],
    // 파일 감시 안정성 개선
    serverComponentsExternalPackages: [],
    // Turbopack 설정
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },

  // Webpack configuration for development
  webpack: (config: Configuration, { isServer }: { dev: boolean; isServer: boolean }) => {
    // Bundle analyzer integration
    if (process.env.ANALYZE === 'true' && !isServer) {
      // Dynamic import to avoid bundling in production
      import('webpack-bundle-analyzer').then(({ BundleAnalyzerPlugin }) => {
        config.plugins?.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: '../analyze/client.html',
            openAnalyzer: false,
          })
        );
      }).catch(console.error);
    }

    return config;
  },

  // Output configuration
  // output: 'standalone',

  // Resolve workspace root warning
  outputFileTracingRoot: __dirname,

};

export default nextConfig;
