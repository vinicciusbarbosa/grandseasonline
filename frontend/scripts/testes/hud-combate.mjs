import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Teste do contrato HUD ↔ combate. Sem renderer, API ou conexão multiplayer.
globalThis.window={setInterval};
const vite=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'});
let controle;
try {
  const {ControleBatalha}=await vite.ssrLoadModule('/src/tabuleiro/batalha/controle.ts');
  const marcas=[];
  const palco={personagem:()=>undefined,avisar(){},limparMarcas(){marcas.length=0},marcar(c,t){marcas.push({...c,t})}};
  controle=new ControleBatalha(palco);
  controle.fase='minha';controle.estado.vez='piratas';
  controle.animar=async()=>{};
  const c=controle.combatentes.find(c=>c.id==='pirata-capitao');
  c.espirito=80;c.energia=75;c.akuma={fruta:'fogo',transformado:0};c.profissao='medico';
  c.casa={l:0,c:0};c.haki.rei=true;
  controle.selecionar(c.id);
  const skills=controle.retrato().selecionado.skills;
  assert.ok(skills.filter(k=>k.origem==='arma').length>0);
  assert.ok(skills.filter(k=>k.origem==='fruta'&&!k.buff).length>0);
  assert.equal(skills.find(k=>k.id==='corpo-chamas').buff,true);
  assert.equal(skills.find(k=>k.id==='primeiros-socorros').origem,'suporte');
  assert.equal(skills.find(k=>k.id==='primeiros-socorros').buff,false);
  assert.equal(skills.find(k=>k.id==='haoshoku').espirito,50);

  controle.escolherSkill('haoshoku');
  let hud=controle.retrato().selecionado;
  assert.equal(hud.skill,'haoshoku');assert.equal(hud.previa,true);
  assert.equal(c.espirito,80,'Selecionar não deve gastar espírito');
  assert.ok(marcas.filter(m=>m.t==='area').length>0);
  assert.ok(marcas.every(m=>m.l>=0&&m.l<10&&m.c>=0&&m.c<20),'Previa de Haki fora do tabuleiro');
  controle.sobre({l:8,c:19});
  assert.deepEqual(controle.previa,c.casa,'A área deve permanecer centrada no personagem');
  controle.usarPrevia();await new Promise(r=>setImmediate(r));
  const depois=controle.combatentes.find(x=>x.id===c.id);
  assert.equal(depois.espirito,30);assert.equal(depois.energia,75);
  assert.equal(controle.estado.vez,'piratas','Haki não deve encerrar a vez');
  hud=controle.retrato().selecionado;
  assert.notEqual(hud.skill,'haoshoku','Depois de usar, deve sair da seleção de Haki');
  assert.match(hud.skills.find(k=>k.id==='haoshoku').motivo,/Espírito insuficiente/);
  controle.alternarArmamento(c.id);await new Promise(r=>setImmediate(r));
  assert.equal(controle.retrato().selecionado.armamento.ligado,true);
  controle.alternarArmamento(c.id);await new Promise(r=>setImmediate(r));
  assert.equal(controle.retrato().selecionado.armamento.ligado,false);
  controle.observar(c.id);await new Promise(r=>setImmediate(r));
  assert.equal(controle.retrato().selecionado.observacao.ligado,true);
  controle.observar(c.id);await new Promise(r=>setImmediate(r));
  assert.equal(controle.retrato().selecionado.observacao.ligado,false);
  assert.equal(controle.estado.vez,'piratas');
  console.log('OK: arma/fruta/buff/suporte, seleção e área do Rei, custo só ao confirmar, limite do tabuleiro, fim da seleção, espírito insuficiente, alternância de Armamento e Observação.');
} finally {controle?.destruir();await vite.close();delete globalThis.window;}
