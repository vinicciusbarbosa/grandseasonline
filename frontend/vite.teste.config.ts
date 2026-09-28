import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build só do teste de tabuleiro: `npm run build:teste` → dist-teste/
// (caminhos relativos, dá para abrir de qualquer pasta ou publicar).
export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist-teste',
    emptyOutDir: true,
    rollupOptions: { input: 'teste-tabuleiro.html' },
  },
})
