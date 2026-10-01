import { createRoot } from 'react-dom/client'
import TelaTurnos from './TelaTurnos'

// Entrada avulsa do teste de turnos (build separado, para abrir em qualquer
// lugar — inclusive no celular — sem o resto do jogo).
createRoot(document.getElementById('raiz')!).render(<TelaTurnos />)
