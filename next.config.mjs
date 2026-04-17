/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "flippay.app",
          },
        ],
        destination: "https://www.flippay.app/:path*",
        permanent: true,
      },
    ];
  },
  /**
   * Proxy `/api/*` on this app to the FlipPay backend so the browser stays same-origin.
   * That keeps `X-Session-Token` and avoids CORS failures in production.
   *
   * Set `NEXT_PUBLIC_API_URL` to your backend base (no trailing slash), e.g. `https://api.example.com`.
   * - Dev: defaults to `http://localhost:3001` when unset.
   * - Production: rewrites are only applied when `NEXT_PUBLIC_API_URL` is set (required for deploy).
   */
  async rewrites() {
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
    const isProd = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

    if (isProd) {
      if (!apiUrl) return [];
      return [
        {
          source: "/api/:path*",
          destination: `${apiUrl}/api/:path*`,
        },
      ];
    }

    const destinationBase = apiUrl || "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${destinationBase}/api/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
        pathname: '/coins/images/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cryptologos.cc',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'academy-public.coinmarketcap.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: [
      '@mysten/sui',
      '@solana/web3.js',
      'ethers',
      'viem',
      'wagmi',
      'recharts',
      '@tanstack/react-query',
    ],
  },
  // Turbopack configuration (Next.js 16 uses Turbopack by default)
  turbopack: {
    // Resolve aliases for packages with subpath exports
    resolveAlias: {
      // Fix for @scure/bip39 wordlists resolution in Turbopack
      '@scure/bip39/wordlists/english': '@scure/bip39/wordlists/english.js',
    },
  },
};

export default nextConfig;

