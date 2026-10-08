/** Contexto Effekseer WebGL. O jogo fornece os alvos confirmados e controla o dano. */
export function criarCortePerfurante({context, efeitos, origem, destino, passagens = [], altura = .95, escala = 1, duracao = .4, atraso = 4/60, aoPerfurar, aoChegar}) {
  const de = {...origem, y: (origem.y ?? 0)+altura};
  const ate = {...destino, y: (destino.y ?? 0)+altura};
  if (![de.x,de.y,de.z,ate.x,ate.y,ate.z,escala,duracao,atraso].every(Number.isFinite) || escala<=0 || duracao<=0 || duracao>1.8 || atraso<0) throw new RangeError('Posicoes finitas, escala positiva, duracao > 0 e <= 1.8 s, atraso >= 0.');
  if (!context || !['projetil','disparo','perfuracao','dissipacao'].every(k=>efeitos?.[k])) throw new TypeError('Forneca contexto e os quatro efeitos carregados.');
  const dx=ate.x-de.x,dy=ate.y-de.y,dz=ate.z-de.z;
  if (Math.hypot(dx,dz)<1e-8) throw new RangeError('Origem e destino distintos no plano XZ.');
  const alvos=passagens.map(p=>({...p})).sort((a,b)=>a.fracao-b.fracao);
  if (alvos.some(p=>!Number.isFinite(p.fracao)||p.fracao<0||p.fracao>1)) throw new RangeError('Cada passagem precisa de fracao entre 0 e 1.');
  const yaw=Math.atan2(dx,dz),pitch=-Math.atan2(dy,Math.hypot(dx,dz)),handles=[];
  const ponto=u=>({x:de.x+dx*u,y:de.y+dy*u,z:de.z+dz*u});
  function tocar(effect,p) {
    const h=context.play(effect,p.x,p.y,p.z);
    if (!h) throw new Error('Nao foi possivel iniciar o efeito.');
    h.setScale(escala,escala,escala);h.setRotation(pitch,yaw,0);handles.push(h);return h;
  }
  tocar(efeitos.disparo,de);
  let tempo=0,projetil=null,finalizado=false,indice=0;
  return {
    get finalizado(){return finalizado},
    atualizar(dt) {
      if (!Number.isFinite(dt)||dt<0) throw new RangeError('dt em segundos, >= 0.');
      if(finalizado)return;
      tempo+=dt;if(tempo<atraso)return;
      if(!projetil)projetil=tocar(efeitos.projetil,de);
      const u=Math.min(1,(tempo-atraso)/duracao),p=ponto(u);
      projetil.setLocation(p.x,p.y,p.z);
      while(indice<alvos.length && alvos[indice].fracao<=u) {
        const alvo=alvos[indice++],pos=ponto(alvo.fracao);
        tocar(efeitos.perfuracao,pos);aoPerfurar?.(alvo,{...pos});
        if(finalizado)return;
      }
      if(u>=1){projetil.stop();tocar(efeitos.dissipacao,ate);finalizado=true;aoChegar?.({...ate});}
    },
    cancelar(){for(const h of handles)h.stop();finalizado=true;}
  };
}
