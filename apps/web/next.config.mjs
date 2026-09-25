/** @type {import('next').NextConfig} */
const nextConfig = {
  // Paket workspace di-ekspor sebagai TypeScript mentah supaya tidak ada langkah
  // build antar-paket; Next yang mentranspilasinya.
  transpilePackages: ['@cek-dulu/shared', '@cek-dulu/sectors', '@cek-dulu/verifiers'],

  experimental: {
    // Bab 3.7: satu cek bisa 15-40 detik. Route handler mengalirkan SSE selama itu.
    proxyTimeout: 120_000,
  },

  webpack(config) {
    // Impor relatif ditulis dengan akhiran `.js` sesuai aturan ESM TypeScript
    // (`moduleResolution: Bundler` menerimanya, begitu juga Node dan Vitest).
    // Webpack tidak tahu aturan itu, jadi pemetaannya dinyatakan di sini.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },

  turbopack: {
    resolveAlias: {},
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
  },
};

export default nextConfig;
