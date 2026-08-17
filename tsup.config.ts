import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: true,
  define: {
    PKG_VERSION: JSON.stringify(process.env.npm_package_version || '0.1.0'),
  },
});
