import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { Vector3 } from 'three';
import { readFile } from 'node:fs/promises';

// O clarão deve esperar o quadro de choque; o núcleo permanece suspenso
// entre os combatentes, em vez de reaproveitar a emissão a partir do chão.
globalThis.window={setInterval};
const vite=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'});
let controle;
try {
 const {ControleBatalha}=await vite.ssrLoadModule('/src/tabuleiro/batalha/controle.ts');
 const calls=[];let liberar,avisarInicio;
 const barreira=new Promise(r=>liberar=r),inicio=new Promise(r=>avisarInicio=r);
 const a={id:'pirata-capitao',pos:new Vector3(2,0,3),haki:false,atacar(_alvo,cb){cb()}};
 const b={id:'marine-capitao',pos:new Vector3(4,0,5),haki:false,atacar(_alvo,cb){cb()}};
 let centro,direcao;
 const palco={
  personagem:id=>id===a.id?a:id===b.id?b:undefined,
  peito:p=>p.pos.clone().setY(1.25),avisar(){},limparMarcas(){},
  flutuar(){},tremer(){},choqueTela(){},efeito:async()=>{},
  choqueRei(p,d){centro=p.clone();direcao=d.clone();calls.push('pressao');avisarInicio();return barreira},
  lampejo(){calls.push('clarao')},
 };
 controle=new ControleBatalha(palco);
 const animacao=controle.animarClash(controle.estado,{t:'clash',de:a.id,alvo:b.id,resultado:'empate',dano:0});
 await inicio;
 assert.deepEqual(centro.toArray(),[3,1.25,4],'O clash deve nascer no ponto médio, na altura dos ataques');
 assert.deepEqual(direcao.toArray(),[2,0,2],'As energias devem se opor no eixo dos combatentes');
 assert.deepEqual(calls,['pressao'],'O clarão não deve antecipar o impacto enquanto o efeito carrega/converge');
 assert.equal(a.haki,'rei');assert.equal(b.haki,'rei');
 liberar();await animacao;
 assert.equal(calls[1],'clarao');assert.equal(a.haki,false);assert.equal(b.haki,false);
 for(const nome of ['haki-clash','haki-clash-onda']) {
  const raiz=new URL(`../../public/sprites/efk/${nome}/`,import.meta.url);
  const efeito=JSON.parse(await readFile(new URL('efeito.json',raiz),'utf8'));
  assert.ok(efeito.fim>0&&efeito.fim<=110);
  const nos=[];const visitar=n=>{nos.push(n);n.filhos.forEach(visitar)};efeito.filhos.forEach(visitar);
  assert.ok(nos.every(n=>!n.eterno),'O clash precisa desaparecer sozinho');
  for(const tex of efeito.texturas)assert.ok((await readFile(new URL(tex,raiz))).length>20);
  for(const arq of efeito.modelos) {
   const mod=JSON.parse(await readFile(new URL(arq+'.json',raiz),'utf8'));
   assert.ok(mod.poses.length>10&&mod.poses.length<=48);
   assert.ok([...mod.min,...mod.max].every(Number.isFinite));
   assert.ok(mod.poses.some(p=>p.length>0));
  }
 }
 console.log('OK: núcleo suspenso, eixo entre atacantes, clarão sincronizado, Haki limpo após empate; texturas/modelos completos e efeito finito.');
} finally {controle?.destruir();await vite.close();delete globalThis.window;}
