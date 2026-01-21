// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config: any) {
    // Conserva warnings ignorados que ya tengas
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /@supabase\/realtime-js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];
    return config;
  },
};

export default nextConfig;
