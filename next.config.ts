import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['10.8.75.89'],
  redirects: async () => [
    {
      source: '/work-management/weekly-plan',
      destination: '/weekly-plan',
      permanent: true,
    },
  ],
};

export default nextConfig;
