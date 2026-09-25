import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// A API C# roda em http://localhost:5047 (backend/src/SugoiGame.Api).
const API = process.env.SUGOI_API ?? 'http://localhost:5047'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Passar pelo proxy deixa front e API na mesma origem em desenvolvimento:
      // não há CORS no caminho e os cookies de sessão (sg_c/sg_k) valem também
      // para o jogo em PHP, que roda no mesmo host.
      '/api': {
        target: API,
        changeOrigin: false,
      },

      // A arte original do jogo (public/Imagens, ~24 mil arquivos) é servida pela
      // API a partir do disco, em vez de duplicada dentro do front.
      '/imagens': {
        target: API,
        changeOrigin: false,
      },
    },
  },
})
