// Efeitos previamente carregados: { feixe, reflexo, explosao }.
// Pontos mundiais: [emissao, reflexao1, reflexao2, reflexao3, reflexao4, impacto].
// O jogo atualiza o contexto do Effekseer uma vez por frame, fora deste módulo.
export function criarYataPersonalizado(contexto, efeitos, pontos, largura = 1) {
  if (pontos.length !== 6 || pontos.some(p => p.length !== 3 || !p.every(Number.isFinite))) {
    throw new Error('Yata precisa de seis pontos XYZ: emissão, quatro reflexões e impacto.');
  }
  if (!Number.isFinite(largura) || largura <= 0) throw new Error('Largura deve ser positiva.');
  pontos = pontos.map(p => [...p]); // Capturar a trajetória no início da habilidade.
  const trechos = [[10,22],[22,34],[34,46],[46,58],[66,72]].map(([inicio,fim],i) => {
    const a = [...pontos[i]], b = [...pontos[i+1]];
    const vetor = b.map((valor,k) => valor-a[k]);
    const distancia = Math.hypot(...vetor);
    if (distancia < 0.001) throw new Error('Dois pontos consecutivos não podem coincidir.');
    return { inicio:inicio/60, fim:fim/60, a, b, distancia,
      pitch:-Math.asin(vetor[1]/distancia), yaw:Math.atan2(vetor[0],vetor[2]),
      handle:null, encerrado:false };
  });
  const eventos = [
    { tempo:0, efeito:efeitos.reflexo, ponto:pontos[0] },
    ...[22,34,46,58].map((frame,i) => ({tempo:frame/60,efeito:efeitos.reflexo,ponto:pontos[i+1]})),
    { tempo:72/60, efeito:efeitos.explosao, ponto:pontos[5] }
  ];
  const instancias = [];
  let tempo = 0, concluido = false;
  function atualizarEventos() {
    for (const evento of eventos) {
      if (evento.disparado || tempo < evento.tempo) continue;
      instancias.push(contexto.play(evento.efeito, ...evento.ponto));
      evento.disparado = true;
    }
  }
  atualizarEventos();
  return {
    get concluido() { return concluido; },
    atualizar(deltaSegundos) {
      if (concluido) return false;
      if (!Number.isFinite(deltaSegundos) || deltaSegundos < 0) throw new Error('Delta de tempo inválido.');
      tempo += deltaSegundos;
      atualizarEventos();
      trechos.forEach((trecho,i) => {
        const apagar = i < 4 ? 72/60 : 80/60;
        if (tempo < trecho.inicio || trecho.encerrado) return;
        if (tempo >= apagar) {
          if (trecho.handle) trecho.handle.stop();
          trecho.encerrado = true;
          return;
        }
        if (!trecho.handle) {
          trecho.handle = contexto.play(efeitos.feixe, ...trecho.a);
          trecho.handle.setRotation(trecho.pitch, trecho.yaw, 0);
          instancias.push(trecho.handle);
        }
        const progresso = Math.min(1,(tempo-trecho.inicio)/(trecho.fim-trecho.inicio));
        const espessura = largura*(i===4 ? 1.5 : 1);
        trecho.handle.setScale(espessura,espessura,Math.max(.001,trecho.distancia*progresso));
      });
      if (tempo >= 160/60) concluido = true;
      return !concluido;
    },
    cancelar() {
      instancias.forEach(handle => handle.stop());
      concluido = true;
    }
  };
}
