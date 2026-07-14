/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output keeps the Docker image small and self-contained.
  output: 'standalone',
  eslint: {
    // Linting is run separately in CI; don't block production builds on it.
    ignoreDuringBuilds: true,
  },
  // Playwright must stay a real Node dependency (native browser binary),
  // never bundled by the Next.js server compiler.
  serverExternalPackages: ['playwright', 'playwright-core'],
};

export default nextConfig;
