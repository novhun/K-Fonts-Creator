/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["opentype.js"],
  },
  webpack: (config, { isServer }) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    // wawoff2's Emscripten glue code guards `require('fs'/'path')` behind an
    // ENVIRONMENT_IS_NODE check, so it's safe in the browser, but webpack
    // still tries to statically resolve those requires unless told not to.
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    }
    return config;
  },
};

module.exports = nextConfig;
