/** Adapter for an Effekseer WebGL context; call atualizar(dtSeconds) from the game tick. */
export function criarRajada({context, efeitos, origem, destino, altura = .8, escala = 1, duracao = .5, atraso = .1, aoChegar}) {
  const de = {...origem, y: (origem.y ?? 0) + altura};
  const ate = {...destino, y: (destino.y ?? 0) + altura};
  if (![de.x,de.y,de.z,ate.x,ate.y,ate.z,altura,escala,duracao,atraso].every(Number.isFinite) || escala <= 0 || duracao <= 0 || duracao > 1.3 || atraso < 0) {
    throw new RangeError('Posicoes finitas; escala positiva; duracao de voo > 0 e <= 1.3 s; atraso >= 0.');
  }
  if (!context || !efeitos?.projetil || !efeitos?.impacto || !efeitos?.disparo) throw new TypeError('Forneca o contexto e os tres efeitos carregados.');
  const dx = ate.x-de.x, dz=ate.z-de.z;
  if (Math.hypot(dx,dz) < 1e-8) throw new RangeError('Origem e destino precisam ser distintos no plano XZ.');
  const yaw=Math.atan2(dx,dz);const handles=[];
  function tocar(effect,p) {
    const h=context.play(effect,p.x,p.y,p.z);
    if (!h) throw new Error('Nao foi possivel iniciar o efeito.');
    h.setScale(escala,escala,escala);h.setRotation(0,yaw,0);handles.push(h);return h;
  }
  tocar(efeitos.disparo,de);
  let tempo=0,projetil=null,finalizado=false;
  return {
    get finalizado(){return finalizado},
    atualizar(dt) {
      if (!Number.isFinite(dt) || dt<0) throw new RangeError('dt deve estar em segundos e ser >= 0.');
      if (finalizado) return;
      tempo+=dt;if(tempo<atraso)return;
      if(!projetil)projetil=tocar(efeitos.projetil,de);
      const u=Math.min(1,(tempo-atraso)/duracao);
      projetil.setLocation(de.x+dx*u,de.y+(ate.y-de.y)*u,de.z+dz*u);
      if(u>=1){projetil.stop();tocar(efeitos.impacto,ate);finalizado=true;aoChegar?.({...ate});}
    },
    cancelar(){for(const h of handles)h.stop();finalizado=true;}
  };
}
