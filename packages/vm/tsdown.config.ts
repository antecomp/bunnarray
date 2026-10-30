import { defineConfig } from 'tsdown';

// npm run build -w @bunnarray/vm
export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true
});