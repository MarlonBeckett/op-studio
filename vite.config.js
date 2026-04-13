import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5273,
    host: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
})
