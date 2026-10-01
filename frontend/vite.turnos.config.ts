import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build só do teste de turnos: `npm run build:turnos` → dist-turnos/
// (depois: python3 scripts/pagina_unica.py saida.html --dist=dist-turnos ...)
export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist-turnos',
    emptyOutDir: true,
    rollupOptions: { input: 'teste-turnos.html' },
  },
})
