import { createRoot } from 'react-dom/client'
import TelaTabuleiro from './TelaTabuleiro'

// Entrada avulsa do teste de tabuleiro (build separado, para abrir em
// qualquer lugar — inclusive no celular — sem o resto do jogo).
createRoot(document.getElementById('raiz')!).render(<TelaTabuleiro />)
