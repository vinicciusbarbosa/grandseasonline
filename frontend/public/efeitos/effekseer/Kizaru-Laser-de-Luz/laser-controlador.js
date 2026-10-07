// Efeitos carregados: { carga, laser, disparo, contato (opcional) }.
// Este módulo controla as instâncias. O jogo atualiza o contexto do Effekseer.
export function criarLaserContinuo(contexto, efeitos, {
  origem = [0,0,0], direcao = [0,0,1], comprimento = 8,
  largura = 1, tempoCarga = .9
} = {}) {
  if (![largura,tempoCarga].every(Number.isFinite) || largura <= 0 || tempoCarga < 0) {
    throw new Error('Largura positiva e tempo de carga não negativo são necessários.');
  }
  let pos, dir, alcance, tocando = false;
  let carga = null, feixe = null, disparo = null, contato = null;
  let tempo = 0, estado = 'carregando';
  function guardarPose(p,d,l) {
    if (!p || !d || p.length !== 3 || d.length !== 3 || ![...p,...d,l].every(Number.isFinite) || l <= 0) {
      throw new Error('Use origem e direção XYZ finitas, com comprimento positivo.');
    }
    const modulo = Math.hypot(...d);
    if (modulo < 1e-6) throw new Error('A direção do laser não pode ser zero.');
    pos = [...p]; dir = d.map(x=>x/modulo); alcance = l;
  }
  guardarPose(origem,direcao,comprimento);
  carga = contexto.play(efeitos.carga,...pos);
  function aplicarPose() {
    const pitch = -Math.asin(dir[1]), yaw = Math.atan2(dir[0],dir[2]);
    for (const h of [carga,disparo]) if (h) {
      h.setLocation(...pos);h.setRotation(pitch,yaw,0);h.setScale(largura,largura,largura);
    }
    if (feixe) {
      feixe.setLocation(...pos);feixe.setRotation(pitch,yaw,0);
      feixe.setScale(largura,largura,alcance/8);
    }
    if (estado === 'disparando' && tocando && efeitos.contato) {
      const ponto = pos.map((x,i)=>x+dir[i]*alcance);
      if (!contato) contato = contexto.play(efeitos.contato,...ponto);
      contato.setLocation(...ponto);contato.setRotation(pitch,yaw,0);contato.setScale(largura,largura,largura);
    } else if (contato) { contato.stop(); contato = null; }
  }
  aplicarPose();
  return {
    get estado() { return estado; },
    posicionar(novaOrigem, novaDirecao, novoComprimento, contatoConfirmado = false) {
      if (estado === 'encerrado') return;
      guardarPose(novaOrigem,novaDirecao,novoComprimento);
      tocando = !!contatoConfirmado;aplicarPose();
    },
    atualizar(deltaSegundos) {
      if (estado === 'encerrado') return false;
      if (!Number.isFinite(deltaSegundos) || deltaSegundos < 0) throw new Error('Delta de tempo inválido.');
      tempo += deltaSegundos;
      if (estado === 'carregando' && tempo+1e-9 >= tempoCarga) {
        carga.stop();carga = null;
        feixe = contexto.play(efeitos.laser,...pos);
        disparo = contexto.play(efeitos.disparo,...pos);
        estado = 'disparando';
      }
      aplicarPose();return true;
    },
    encerrar() {
      for (const h of [carga,feixe,disparo,contato]) if (h) h.stop();
      carga = feixe = disparo = contato = null;estado = 'encerrado';
    }
  };
}
