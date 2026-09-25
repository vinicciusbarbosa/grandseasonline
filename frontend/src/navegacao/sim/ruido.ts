/** Ruído de valor 1D suave e determinístico: mesma semente, mesmo resultado. */
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function ruido1d(t: number, semente = 0) {
  const i = Math.floor(t)
  const f = t - i
  const u = f * f * (3 - 2 * f)
  return hash(i + semente * 57.3) * (1 - u) + hash(i + 1 + semente * 57.3) * u
}

/** Ruído em -1..1 com duas oitavas, para variações orgânicas no tempo. */
export function ruidoSuave(t: number, semente = 0) {
  return (ruido1d(t, semente) * 0.65 + ruido1d(t * 2.3, semente + 11) * 0.35) * 2 - 1
}

export function diferencaAngular(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export function girarPara(atual: number, alvo: number, passoMax: number) {
  const d = diferencaAngular(atual, alvo)
  if (Math.abs(d) <= passoMax) return alvo
  return atual + Math.sign(d) * passoMax
}
