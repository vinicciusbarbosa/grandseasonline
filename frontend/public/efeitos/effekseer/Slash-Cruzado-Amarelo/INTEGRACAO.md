# Slash cruzado amarelo

Dois cortes rápidos de espada formando X. Núcleo branco, borda amarela, glow dourado, filamentos finos e faíscas no cruzamento. Apenas o efeito, sem personagem.

Use `Slash_Cruzado_Amarelo.efkefc` no runtime e `.efkproj` para editar no Effekseer 1.80.7. Preserve `Model/` e `Texture/` ao lado dos efeitos. Também acompanha `.efk` legado.

- Origem no centro do X/ponto de impacto. Plano XY; frente +Z; raiz fixa.
- Primeiro corte no frame 0; segundo no frame 2. Formação do X em cerca de 0,1 s; cortes dissipam em aproximadamente 0,3 s; faíscas acabam antes de 0,5 s. Frame 40 verificado vazio.
- Largura e altura aproximadas do X: 2,85 unidades. Ajuste escala ao personagem.
- Para o X legível na câmera elevada, alinhe a rotação ao plano da câmera, como o corte básico atual. No Effekseer WebGL, passe os ângulos em radianos para `handle.setRotation(...)`.
- Para o tocador Three.js do jogo, converta o `.efkproj` com `frontend/scripts/efeitos/efk_converter.py`; posicione o grupo na altura do contato, copie o quaternion da câmera e aplique a escala desejada.

Exportado e renderizado no runtime Effekseer WebGL, em três ângulos; verificadas animação rápida, variação das partículas por semente e dissipação. Pack salvo em `frontend/public/efeitos/effekseer/Slash-Cruzado-Amarelo/`; ainda não ligado ao cadastro de skills.
