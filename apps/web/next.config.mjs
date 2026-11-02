/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@prajeeth/types'],
  async rewrites() {
    // In local development, proxy /api/v1 calls to the NestJS API if needed
    const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [
      {
        source: '/backend-api/:path*',
        destination: `${apiHost}/:path*`
      }
    ];
  }
};

export default nextConfig;
