# Migração: PHP → React + C#

O jogo legado em PHP continua inteiro em `public/` e funcionando. Ao lado dele
subimos uma API em C# (`backend/`) e um front em React (`frontend/`) que
compartilham o **mesmo banco MySQL** e a **mesma sessão**. Cada fatia migrada
deixa de passar pelo PHP; nada quebra no caminho.

## O tamanho do problema

| | |
|---|---|
| PHP (sem vendor) | ~60.000 linhas |
| Tabelas MySQL | 189 |
| Telas (`public/Sessoes/`) | 103 |
| Endpoints AJAX (`public/Scripts/`) | 326 |
| Regras de jogo (`Funcoes/` + `Regras/` + `Classes/`) | ~21.000 linhas |
| Servidores realtime | 2 (chat em Node, mapa em PHP/Ratchet) |

O legado não tem camada de serviço: cada `Scripts/*.php` abre conexão, valida
`$_SESSION`, roda SQL cru e devolve **HTML** — não JSON. `$userDetails` é um
god-object de 70 KB. Por isso a migração é reescrita, não tradução.

## Estrutura

```
sugoigame-novo-leveling/
├── public/          PHP legado — intocado
├── servers/         chat (Node) e mapa (PHP/Ratchet) — ainda não migrados
├── database/        schema.sql (fonte da verdade do banco)
├── backend/         API .NET 9, Clean Architecture
│   ├── src/
│   │   ├── SugoiGame.Domain/          entidades e regras de jogo
│   │   ├── SugoiGame.Application/     serviços, DTOs, contratos
│   │   ├── SugoiGame.Infrastructure/  EF Core sobre o schema legado
│   │   └── SugoiGame.Api/             minimal APIs, autenticação, CORS
│   └── tests/SugoiGame.Tests/         102 testes, sem dependência de banco
└── frontend/        React 19 + Vite + TypeScript + Tailwind + TanStack Query
```

## Como rodar

### Banco

Via Docker, usando o `docker-compose.yml` que já existia — cria o banco, o
usuário e importa `schema.sql` + os seeds sozinho:

```bash
docker compose up -d mysql
```

Sem Docker, com MySQL instalado nativamente (é o setup usado no ambiente de
desenvolvimento atual — MySQL 8.4 como serviço Windows `MySQL84`): crie o banco
e o usuário com as mesmas credenciais do compose, e importe
`database/schema.sql` primeiro, depois os `database/tb_*.sql` em ordem
alfabética.

```sql
CREATE DATABASE sugoi_v2 CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci;
CREATE USER 'sugoigame_user'@'localhost' IDENTIFIED BY 'sugoigame_pass';
GRANT ALL PRIVILEGES ON sugoi_v2.* TO 'sugoigame_user'@'localhost';
```

Sobre o plugin de autenticação: o compose sobe `mysql:8.0` com
`mysql_native_password`, mas o MySQL 8.4 já usa `caching_sha2_password` e não
oferece mais o legado no instalador. **Os dois funcionam sem mudar a connection
string** — o 8.4 vem com TLS ligado por padrão e o MySqlConnector negocia a
conexão cifrada, que é o que o `caching_sha2_password` exige. Só se o servidor
rodar sem TLS é que a string precisaria de `AllowPublicKeyRetrieval=True`.

O PHP legado é que ainda depende de `mysql_native_password` no `mysqli`; se for
rodar o legado contra um MySQL 8.4 nativo, o plugin precisa ser reativado.

`Banco:VersaoMySql` fica em `8.0.36` de propósito: é o menor denominador comum
entre o container `mysql:8.0` e uma instalação nativa mais nova. Declarar uma
versão menor que a real é seguro; o contrário não.

API (http://localhost:5047):

```bash
dotnet run --project backend/src/SugoiGame.Api
```

Front (http://localhost:5173):

```bash
npm --prefix frontend run dev
```

O Vite faz proxy de `/api` para a porta 5047, então front e API ficam na mesma
origem em desenvolvimento — sem CORS no caminho, e os cookies valem também para
o PHP em `localhost:80`.

Testes do backend:

```bash
dotnet test backend
```

## A peça central: sessão compartilhada

É o que permite as duas aplicações conviverem.

O PHP autentica lendo dois cookies (`Classes/UserDetails.php`):

- `sg_c` — id da conta
- `sg_k` — token, comparado com a coluna `tb_conta.cookie`

A API C# faz exatamente o mesmo, em `SugoiCookieHandler`. Consequências:

- Quem loga pelo React fica logado no jogo em PHP, e vice-versa.
- Logout pela API zera `tb_conta.cookie` e derruba as duas sessões.
- Senhas usam bcrypt `$2y$` com custo 10 — o que o `password_hash()` do PHP
  produz — então os dois lados leem o hash um do outro.

Quando o PHP sair de cena, esse esquema pode dar lugar a algo mais robusto.
Até lá, mudar o formato quebra o legado.

## O que já foi portado

**Autenticação** (`Scripts/Geral/logar.php`, `cadastro.php`, `deslogar.php`)

- `POST /api/auth/login`
- `POST /api/auth/cadastro` — inclui o vínculo de indicação (`tb_afilhados`)
- `POST /api/auth/logout`
- `GET /api/sessao`

**Tripulações** (`Scripts/Geral/criartrip.php`, `seltrip.php`)

- `GET /api/tripulacoes`
- `POST /api/tripulacoes` — cria tripulação, capitão e registro VIP em transação
- `POST /api/tripulacoes/{id}/selecionar`

**Status do personagem** (`Sessoes/status.php`, `Scripts/Personagem/adiciona_atributo.php`,
`personagem_evoluir.php`)

- `GET /api/personagens`
- `GET /api/personagens/{cod}`
- `POST /api/personagens/{cod}/atributos`
- `POST /api/personagens/{cod}/evoluir`

**Inventário e equipamentos** (`Scripts/Inventario/inventario.php`,
`Scripts/Personagem/equipamento_equipar.php`, `equipamento_desequipar.php`)

- `GET /api/inventario` — pilhas do porão com o detalhe de cada tipo resolvido
- `POST /api/inventario/{id}/descartar`
- `GET /api/personagens/{cod}/equipamentos`
- `POST /api/personagens/{cod}/equipamentos` — veste, devolvendo a peça trocada
- `DELETE /api/personagens/{cod}/equipamentos/{slot}`

O bônus de atributo vindo de equipamento, acessório e Haki entra em
`BonusAtributos` e aparece na ficha de status.

Telas no React: login, cadastro, seleção/criação de tripulação, status e porão.

### Fora do escopo desta fatia

- **Passivos de habilidade** no cálculo de bônus. `calc_bonus()` também soma os
  efeitos passivos vindos de `Regras\Habilidades`, que dependem de um sistema de
  efeitos inteiro. Equipamento, acessório e Haki já estão cobertos.
- **Treino de equipamento.** A tabela `tb_personagem_equip_treino` está mapeada,
  mas o multiplicador que ela alimenta está fixo em 1 no próprio legado
  (`$treinos[$slot]["porcent"] = 1`), ou seja, o sistema está desligado lá também.
- **Peças de navio** (casco, leme, velas, canhão, mapa, pose) no inventário. As
  tabelas existem e estão mapeadas, mas vêm vazias nos seeds — esses itens
  aparecem como desconhecidos até a fatia do estaleiro.
- **Envio de e-mail de ativação.** `IEnviadorEmail` tem só a implementação que
  escreve no log (o código sai lá, dá para testar o cadastro ponta a ponta).
  Trocar por um provedor real é decisão de infra à parte.
- **Seletor de sprite do capitão.** A criação sorteia um dos 369 ícones; a
  galeria depende de migrar os assets de `public/Imagens/`.

## Protótipo de navegação oceânica (`/navegacao`)

Teste para decidir entre React + Phaser e Unity: a tela de navegação feita o
mais perto possível do que ela deve ser. Roda sem API e sem login —
`npm --prefix frontend run dev` e abrir http://localhost:5173/navegacao.

Recorte usado: o **East Blue** (células 230–460 × 0–112 do mundo legado), com
as 7 ilhas com nome, as ilhotas e a entrada do canal da Reverse Mountain.

```
frontend/src/navegacao/
├── mundo/        Mundo.ts (camada lógica) + mundo.json (gerado)
├── sim/          regras puras, sem Phaser: rota (A*), navio, vento, ondas, descoberta
├── cena/         Phaser: shader do oceano, navios, esteira, ilhas, correntes
├── painel.ts     ponte cena → HUD (useSyncExternalStore)
└── TelaNavegacao.tsx
```

- **Nenhum tile de imagem.** O mar é um shader: profundidade, ondas,
  espuma na costa, terra, névoa fixa, névoa de descoberta e névoa de borda.
  A única entrada é `public/mundo/terra.png` (96 KB): distância até a costa,
  tipo de terra e névoa, gerada da arte original por
  `frontend/scripts/gerar_mundo.py` (Python com Pillow, numpy, scipy e PyYAML).
- **O mundo real do novo leveling é 460×360 células**, não 200×100 (esse é o
  `Mapa_Oceano` antigo). Ilhas, correntes, névoa e bloqueio já estão nessa
  escala, então foi mantida.
- **A grade continua existindo, mas o jogador não a vê.** O A* roda nas
  células e a rota é "esticada" em poucas retas; o navio persegue um ponto à
  frente na rota, o que vira curva. O botão *Grade* mostra células e chunks.
- **`sim/` não conhece Phaser nem React.** É a parte que vai para o servidor
  (autoritativo) em C# ou que a Unity reimplementaria. A simulação usa passo
  fixo de 1/60 s.
- **Navios desenhados por código**, provisórios: casco, vela, bandeira e
  sombra são texturas separadas. Arte de verdade entra com as mesmas chaves.

Não coberto ainda: redemoinhos (não há nenhum no recorte), clima e
tempestades, encontros, multiplayer e interação ao atracar.

## Decisões de mapeamento

O schema legado tem nomes que enganam. As entidades usam nomes decentes e o
mapeamento fica em `Infrastructure/Persistencia/Configuracoes/`:

| Entidade | Tabela | Pegadinha |
|---|---|---|
| `Conta` | `tb_conta` | `cookie` é o token de sessão; `id_encrip` é o código de indicação |
| `Tripulacao` | `tb_usuarios` | a tabela "usuários" guarda a **tripulação**, não a conta |
| `Personagem` | `tb_personagens` | **PK é `cod`**; `id` é a FK da tripulação — invertido |
| `Vip` | `tb_vip` | PK é também FK da tripulação |

Só as colunas usadas pelas fatias migradas estão mapeadas; as demais continuam
com o PHP. Não há migrations: `database/schema.sql` é a fonte da verdade, e os
valores iniciais das entidades espelham os `DEFAULT` do schema (sem isso, o EF
gravaria zero nas colunas mapeadas em vez de deixar o banco aplicar o default).

## Correções feitas em `database/`

O setup do banco não funcionava do zero — nem por Docker, nem manualmente.
Três problemas, todos corrigidos:

1. **`schema.sql` parava na linha 3062.** A sequência renomeava a coluna e só
   então criava o índice sobre o nome antigo:

   ```sql
   ALTER TABLE tb_personagens_skil CHANGE cod cod_pers ...;
   CREATE UNIQUE INDEX ... ON tb_personagens_skil (cod, cod_skil);  -- cod não existe mais
   ```

   Como o cliente `mysql` para no primeiro erro, as 43 instruções seguintes eram
   ignoradas em silêncio: 2 tabelas (`tb_tripulacao_faccao`,
   `tb_tripulacao_ilha_confrontos`) nunca eram criadas, e o `tb_usuarios` ficava
   sem `influencia`, `nivel_confronto`, `viajante_faccao` e
   `viajante_ilha_origem`. O índice agora aponta para `cod_pers`.

2. **7 dos 10 seeds referenciavam o banco errado.** Os dumps vinham com
   `INSERT INTO sugoi.tb_x`, mas o banco do compose é `sugoi_v2` — todos
   falhavam com *Unknown database 'sugoi'*. O prefixo foi removido, deixando os
   INSERTs sem qualificação, igual ao `schema.sql` e aos 3 seeds que já
   funcionavam.

3. **3 seeds estavam em latin1**, não UTF-8 (`tb_item_reagents`, `tb_navio`,
   `tb_titulos`). O `tb_navio` chegava a importar, mas com acento corrompido.
   Convertidos para UTF-8.

Depois disso: 189 tabelas, 10 seeds sem falha, acentuação correta.

## Lacuna de teste conhecida

Os 102 testes rodam sem banco de propósito — são rápidos e não exigem
infraestrutura. Mas isso deixa um ponto cego: **eles não exercitam o caminho de
desserialização HTTP**.

Um exemplo real disso apareceu na validação contra o MySQL: enviar
`{"atributo":"Berries"}` para `POST /api/personagens/{cod}/atributos` devolvia
**500** em vez de 400. O teste unitário passava `(Atributo)42` direto para o
serviço e nunca chegava perto do binding — onde o `JsonStringEnumConverter`
lançava antes de qualquer validação rodar. Corrigido com o `StatusCodeSelector`
em `Program.cs`, que honra o status que o `BadHttpRequestException` já carrega.

Agora que existe um MySQL permanente no ambiente, vale acrescentar uma camada de
testes de integração com `WebApplicationFactory` cobrindo os contratos HTTP:
códigos de status, formato do ProblemDetails e a gravação dos cookies de sessão.

## Linguagem visual do front

O front **não** segue o visual de painel administrativo. A referência é UI de
jogo (Genshin), e a gramática é fechada:

- **cantoneiras douradas em L** com losango na dobra, nas quatro quinas de todo painel;
- **losango ◆** como motivo único: marcador de rótulo, terminador de divisória, marca de seleção;
- **duas superfícies apenas** — painel escuro translúcido com blur, e pergaminho;
- **seleção por borda luminosa**, nunca por preenchimento chapado;
- medidas de jogo, não de web: botão 46px, linha em pílula 54px, slot 68px,
  ladrilho 92px, raio de 3px. Os tokens estão em `:root` no `frontend/src/index.css`.

O que mais sustenta o resultado é usar a **arte original**: o fundo é a carta
náutica `Backgrounds/conteudo2.jpg`, as molduras de item são as
`Backgrounds/slot1-3.png` aplicadas por raridade, e os ícones de atributo e
recurso vêm de `Imagens/Icones`. A API publica os ~24 mil arquivos de
`public/Imagens` em `/imagens`, servindo do disco em vez de duplicar no front.

Os catálogos de comida, remédio e akuma não estão no banco: vêm de
`public/Data` (JSON e YAML) e são carregados em cache pelo `CatalogoDeDados`.

## Achados no legado

Coisas encontradas ao portar. Nenhuma foi reproduzida no C#, mas **todas
continuam valendo no PHP em produção**:

1. **Escrita arbitrária de coluna** em `Scripts/Personagem/adiciona_atributo.php`.
   O nome do atributo chega pela querystring e é concatenado direto no UPDATE:

   ```php
   $query = "UPDATE tb_personagens SET " . $atr . "='" . $pers[$atr] . "', pts='...'";
   ```

   O `preg_match("/^[\w]+$/")` só garante que são caracteres de palavra — não que
   seja um dos 8 atributos. `?atributo=lvl&quant=45` sobe o nível do personagem.
   Vale o mesmo para `haki_pts`, `hp_max` e qualquer outra coluna da tabela.
   No C# o conjunto é fechado pelo enum `Atributo`.

2. **Sem checagem de dono em `personagem_evoluir.php`.** Diferente do
   `adiciona_atributo.php`, ele não filtra por tripulação ao buscar o personagem.
   No C# a checagem é única, em `PersonagemService.CarregarAsync`.

3. **`id_encrip` previsível.** Gerado como `md5(time())`: dois cadastros no mesmo
   segundo recebem o mesmo código de indicação. No C# vem do gerador
   criptográfico.

4. **Comparação de token com `==`.** `UserDetails::_token_matches` abre margem
   para ataque de temporização. No C# é comparação em tempo constante.

5. **Cadastro travado por falha de SMTP.** Em `Scripts/Geral/cadastro.php` o
   `set_authentication()` só roda se o e-mail for enviado — uma queda de SMTP
   cria a conta mas não loga o jogador, que fica sem saída.

6. **Senha mínima de 5 caracteres.** Mantido por fidelidade, mas configurável em
   `Jogo:TamanhoMinimoSenha`. É o primeiro número a subir quando o legado sair.

7. **Equipar item de outro jogador** em `Scripts/Personagem/equipamento_equipar.php`.
   A busca do item não filtra pela tripulação:

   ```php
   $query = "SELECT * FROM tb_usuario_itens WHERE cod_item='$item' AND tipo_item='14'";
   ```

   Basta saber o `cod_equipamento` para vestir a peça de qualquer jogador. O
   DELETE posterior filtra por `id`, então o item nem sai do dono — ele é
   duplicado. No C# a posse é verificada antes de qualquer coisa.

8. **Códigos dos seeds dependem do AUTO_INCREMENT.** Os dumps em `database/` não
   trazem id explícito, então herdam o contador declarado no `schema.sql`: o
   "Bote" nasce como `cod_navio` 6, não 1. Qualquer código que referencie um id
   de dado de referência por número fixo vai divergir entre ambientes.

## Próximas fatias sugeridas

Na ordem em que uma destrava a outra:

1. **Inventário e itens** — firma o padrão de repositório/serviço num CRUD rico e
   destrava o bônus de equipamento que falta na ficha de status.
2. **Ilhas e navegação** (`Sessoes/oceano.php`, 1.813 linhas) — o coração do
   jogo, e o maior salto de valor percebido.
3. **Servidor de mapa** (`servers/map`, WebSocket em PHP/Ratchet) → SignalR.
4. **Combate** (`Regras/Combate`, `Funcoes/combate.php`) — a fatia mais densa em
   regra pura; melhor deixar para quando o padrão já estiver assentado.
5. **Chat** (`servers/chat`, Node) → SignalR, junto com o mapa.
6. **Fórum, alianças, eventos** — periferia, migra rápido depois do resto.
