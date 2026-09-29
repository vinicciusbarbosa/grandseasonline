# ComfyUI no PC (RX 7600) — gerar sprites com a pose travada

Guia para instalar e usar o ComfyUI no Windows com placa AMD, para gerar as
animações dos personagens com a **pose exata** de cada quadro.

## Por que isso funciona melhor que ChatGPT/Firefly/Midjourney

Nas IAs de chat a pose vai por texto ("perna esquerda à frente…") e a IA
interpreta — por isso ela repete sempre a mesma perna. No ComfyUI a pose vai
como **imagem de esqueleto** (ControlNet OpenPose): cada articulação tem um
ponto, e a IA é obrigada a desenhar o joelho e o pé ali. A aparência do
personagem vem de uma imagem de referência (IP-Adapter).

```
 esqueleto do quadro ──► ControlNet OpenPose ─┐
 imagem do almirante ──► IP-Adapter ──────────┼──► Animagine XL ──► quadro
 texto (estilo)      ──► prompt ──────────────┘   (+ LoRA pixel art)
```

Os esqueletos de cada animação (pernas alternando certinho) e o fluxo pronto
(`.json`) ficam em `docs/comfyui/` — é só abrir e gerar.

---

## 1. O que vai ser instalado (tudo gratuito)

| Peça | O que faz | Licença |
|---|---|---|
| **ComfyUI Desktop** | o programa (interface de nós) | GPL-3.0 |
| **Driver AMD com ROCm** | faz a RX 7600 rodar a IA | gratuito |
| **Animagine XL 4.0** | modelo de imagem estilo anime (SDXL) | CreativeML Open RAIL++-M (uso comercial permitido) |
| **ControlNet OpenPose SDXL** (xinsir) | trava a pose pelo esqueleto | Apache-2.0 |
| **IP-Adapter Plus SDXL** + CLIP Vision ViT-H | copia a aparência do personagem | Apache-2.0 |
| **Pixel Art XL** (LoRA) | puxa o estilo para pixel art | CreativeML OpenRAIL-M |
| **ComfyUI_IPAdapter_plus** (nó extra) | nós do IP-Adapter | GPL-3.0 |

Espaço: ~20 GB. Placa: RX 7600 (8 GB) é suportada pelo ROCm no Windows
(série RX 7600 / XT consta na lista do ComfyUI).

---

## 2. Driver da placa

1. Abra o **AMD Software: Adrenalin Edition** → verifique atualizações e
   instale o driver mais recente. Se a AMD oferecer um driver
   **"ROCm Preview" / "AI"** para Radeon (a versão recomendada pelo ComfyUI
   foi a *ROCm 7.1.1 Preview*), prefira esse.
   Site: https://www.amd.com/en/support
2. Reinicie o PC.

## 3. Instalar o ComfyUI Desktop

1. Baixe em **https://www.comfy.org/download** (Windows).
2. Rode o instalador. Na tela de escolha da placa, deve vir **AMD (ROCm)**
   selecionado — confirme que é essa opção (não "CPU").
3. Pasta de instalação: escolha uma no SSD com espaço, ex.:
   `C:\ComfyUI`. Anote: é aqui que ficam os modelos (`models\…`).
4. Termine e abra. Vai aparecer a tela de nós (um fluxo de exemplo).

**Teste rápido:** clique em **Run** (ou *Queue*). Se gerar uma imagem, a placa
está funcionando. No canto (ou no terminal/log) deve aparecer algo como
`Device: cuda:0 AMD Radeon RX 7600` — "cuda" aparece mesmo sendo AMD, é normal.

> Se o Desktop não reconhecer a placa: dá para instalar a versão "manual"
> (git + Python) com o PyTorch ROCm da AMD. Me avise que eu passo os comandos
> da versão atual.

### Pouca memória (8 GB)
Nas **Configurações** (engrenagem) → **Server Config**, ative a opção de
**VRAM baixa** (`--lowvram`). Se der erro de memória, feche jogos/navegadores
pesados enquanto gera.

## 4. Nós extras (ComfyUI Manager)

O Desktop já vem com o **Manager** (botão *Manager* no topo).

1. **Manager → Custom Nodes Manager** → procure **`ComfyUI_IPAdapter_plus`**
   (autor *cubiq*) → **Install**.
2. Procure **`comfyui_controlnet_aux`** (autor *Fannovel16*) → **Install**
   (serve para ver/editar esqueletos; opcional mas útil).
3. **Restart** quando pedir.

## 5. Baixar os modelos

Baixe cada arquivo e coloque na pasta indicada (dentro da pasta do ComfyUI).
Se o arquivo vier com outro nome, **renomeie** para o nome da tabela — o
fluxo pronto procura esses nomes.

| Arquivo final | Pasta | Baixar de |
|---|---|---|
| `animagine-xl-4.0.safetensors` | `models\checkpoints\` | https://huggingface.co/cagliostrolab/animagine-xl-4.0 (aba *Files*, o `.safetensors` grande) |
| `controlnet-openpose-sdxl.safetensors` | `models\controlnet\` | https://huggingface.co/xinsir/controlnet-openpose-sdxl-1.0 (`diffusion_pytorch_model.safetensors` → renomear) |
| `ip-adapter-plus_sdxl_vit-h.safetensors` | `models\ipadapter\` (crie a pasta se não existir) | https://huggingface.co/h94/IP-Adapter → pasta `sdxl_models` |
| `CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors` | `models\clip_vision\` | https://huggingface.co/h94/IP-Adapter → pasta `models/image_encoder` → `model.safetensors` → renomear |
| `pixel-art-xl.safetensors` | `models\loras\` | https://huggingface.co/nerijs/pixel-art-xl |

Depois de copiar: no ComfyUI, aperte **R** (recarregar a lista de modelos)
ou reinicie.

---

## 6. Como vai ser o uso (depois de instalado)

1. `git pull` no projeto.
2. No ComfyUI: **Workflow → Open** →
   `C:\projsdev\sugoigame\docs\comfyui\sprite_pose.json`.
3. No nó **Personagem (referência)**: carregue o `parado_<direção>.png` do
   personagem (ex.: `docs\sprites\almirante\idle\parado_S.png`).
4. No nó **Esqueletos**: aponte para a pasta da animação
   (ex.: `docs\comfyui\poses\correr_S\`) — são 12 imagens, uma por quadro.
5. **Run**. Sai um quadro por esqueleto em `output\`.
6. Me manda os quadros (ou a pasta) — eu importo, igualo tamanho/cores com o
   idle, reduzo para a pixel art do jogo e ponho no jogo.

### Ajustes que você pode mexer
| Controle | Efeito | Começar com |
|---|---|---|
| **ControlNet strength** | o quanto a pose é obrigatória | 0.9 |
| **IP-Adapter weight** | o quanto copia o personagem | 0.8 |
| **LoRA pixel art** | o quanto puxa para pixel art | 0.8 |
| **Seed** | variação; **fixe** para todos os quadros ficarem parecidos | fixa |
| **Steps / CFG** | qualidade / obediência ao texto | 28 / 5 |

### Prompt base (inglês)
```
1boy, solo, full body, young navy admiral, white peaked cap, spiky black hair,
navy blue double-breasted suit, gold buttons, white admiral coat draped over
shoulders like a cape, holding sheathed saber, running, pixel art, simple
magenta background, masterpiece, high score, great score, absurdres
```
Negativo:
```
lowres, bad anatomy, extra legs, extra arms, text, watermark, multiple views,
shadow on ground, blurry
```

## 7. Problemas comuns
- **Imagem preta / erro de memória:** ative `--lowvram`, reduza para
  832×1216 e gere 1 por vez.
- **Nó vermelho ao abrir o fluxo:** falta um nó extra (seção 4) ou um modelo
  com o nome diferente (seção 5).
- **Personagem muda de rosto entre quadros:** fixe a seed e suba o peso do
  IP-Adapter (0.9–1.0).
- **Pose não obedece:** suba o ControlNet strength (1.0) e confira se o
  esqueleto está no tamanho da imagem.
