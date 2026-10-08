# Zoro — Tatsumaki

Tornado de vento cortante inspirado na referência fornecida: corpo ciano espesso, espirais de borda branca, névoa, filamentos ascendentes, partículas e fragmentos orbitais. O pack contém apenas o efeito, sem personagens.

## Arquivos

| Efeito | Uso | Duração |
| --- | --- | --- |
| `Zoro_Tatsumaki.efkefc` | Skill completa, com formação, giro e dissipação | cerca de 2,2 s; reservar 2,75 s para encerramento |
| `Zoro_Tatsumaki_Continuo.efkefc` | Tornado mantido enquanto a habilidade estiver ativa | chamar `handle.stop()` para encerrar |
| `Zoro_Tatsumaki_Onda_Chao.efkefc` | Onda de pressão independente no solo | cerca de 0,6 s |

Cada efeito acompanha seu `.efkproj` editável e `.efk` exportado. Preserve as pastas `Model/` e `Texture/` ao lado dos efeitos. Modelos e texturas são compartilhados entre as variantes; não é preciso duplicá-los.

## Coordenadas e escala

- Origem local `(0,0,0)` na base do tornado; eixo vertical `+Y`; solo no plano XZ.
- Altura do vento: aproximadamente 5,8 unidades. Diâmetro da parte superior: aproximadamente 5 unidades, com variações de turbulência e halo externo.
- Raio máximo da onda de pressão: aproximadamente 3,35 unidades.
- A raiz não se desloca. Só o vento, os cortes e as partículas se movimentam internamente.
- Posicione a base no solo, junto ao personagem ou alvo. Para um tornado que avance, atualize a posição do handle a partir da lógica do jogo.
- Não é necessário alinhar ao inimigo: o efeito gira em torno de Y. Ajuste a escala ao tamanho de seus personagens e tiles.

## Uso no Effekseer WebGL

```js
const url = '/efeitos/effekseer/Zoro-Tatsumaki/Zoro_Tatsumaki.efkefc';
const effect = context.loadEffect(url, 1, () => {
  const handle = context.play(effect, x, yDoChao, z);
  handle.setScale(escala, escala, escala);
});
```

Para a variante contínua, carregue `Zoro_Tatsumaki_Continuo.efkefc`, guarde o handle e chame `handle.stop()` quando o estado da habilidade terminar. As partículas contínuas são emitidas apenas enquanto esse handle está ativo. O burst de pressão inicial já faz parte das duas variantes; a onda independente serve para repetir um impacto adicional.

Os arquivos foram exportados com Effekseer 1.80.7 e renderizados no runtime WebGL em três ângulos. Foram verificadas a dissipação da skill, a permanência da variante contínua por 900 frames, a remoção por `stop()` e variações de sementes das partículas. O pack está na pasta pública do jogo; o disparo da habilidade e sua lógica de combate ainda devem ser ligados pelo sistema de skills.

O brilho visível vem das camadas aditivas do efeito. Bloom adicional do jogo pode intensificá-lo; regule a exposição para preservar as bordas dos cortes. Desempenho na batalha real depende da quantidade de tornados simultâneos e precisa ser medido nessa cena.
