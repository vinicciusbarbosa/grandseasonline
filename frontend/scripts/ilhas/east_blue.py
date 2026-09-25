"""As ilhas do East Blue, modeladas à mão a partir do anime e da arte do Sugoi.

Coordenadas em células do recorte (as mesmas das docas em mundo.json).
Cada função devolve uma `Ilha` pronta: costa, relevo, materiais e objetos.
"""

from __future__ import annotations

import math

from .kit import (
    AREIA,
    CALCADA,
    CAMPINA,
    CAMPO,
    FLORESTA,
    GRAMA,
    LIXO,
    POMAR,
    RIO,
    ROCHA,
    TERRA_BATIDA,
    Ilha,
    Ocupacao,
    casas_na_rua,
    circulo_pts,
    anel_irregular,
    cidade_em_grade,
    espalhar,
    patamares,
)


def dawn() -> Ilha:
    """Ilha Dawn: o Reino de Goa murado no noroeste (cidade em patamares,
    High Town e o palácio no alto), o Gray Terminal (o lixão fora da
    muralha), o Monte Colubo coberto de mata com a casa da Dadan e a casa na
    árvore, e a Vila Foosha no sul, com moinhos, o Partys Bar e o cais."""
    i = Ilha(1, "Ilha Dawn", 175, 10, 33, 23, semente=11)
    oc = Ocupacao()

    i.contorno([
        (180, 13.2), (184, 11.6), (189, 12.0), (193, 12.8), (197, 11.9), (201, 12.6), (204.5, 14),
        (206.6, 17.2), (205.8, 21.5), (206.4, 25.2), (204.2, 28.6), (201.4, 30.4), (199.2, 31.0),
        (197.2, 31.0), (194.6, 30.4), (192.2, 29.0), (189.5, 27.4), (185.5, 26.9), (181.5, 25.6),
        (178.6, 23.2), (177.2, 19.4), (177.9, 15.6),
    ])
    i.fechar_costa(recorte_px=12, escala_ruido=60)
    i.base(praia=20, planalto=14)

    # Monte Colubo: cordilheira alta no centro-leste, mata até quase o topo.
    i.montanha(197.5, 17.0, 4.4, 235, aspereza=0.5, alongar=(1.3, 1.0, 0.3))
    i.montanha(202.4, 15.8, 3.0, 170, aspereza=0.55)
    i.montanha(193.0, 15.2, 2.6, 120, aspereza=0.5)
    i.montanha(203.8, 22.4, 2.4, 95, aspereza=0.45)
    i.montanha(189.6, 14.2, 1.9, 55, aspereza=0.4)

    # Goa: morro em patamares tortos — cidade baixa, cidade do meio, High Town, palácio.
    cx, cy = 183.6, 18.4
    muro_fora = anel_irregular(i, cx, cy, 5.35, 0.05, 72, 0.3)
    muro_dentro = anel_irregular(i, cx, cy, 2.8, 0.06, 48, 1.1)
    patamares(i, [
        (anel_irregular(i, cx, cy, 5.6, 0.05, 72, 0.3), 26),
        (anel_irregular(i, cx, cy, 4.05, 0.06, 64, 0.8), 40),
        (anel_irregular(i, cx, cy, 2.95, 0.06, 48, 1.1), 58),
        (anel_irregular(i, cx, cy, 1.45, 0.05, 32, 2.0), 72),
    ])
    i.falesia([(176, 13), (181, 11), (186.5, 11), (186, 14.5), (180, 17), (177.5, 21.5), (175.5, 21.5)], 26)

    rio = [(199.5, 20.8), (200.8, 23.4), (201.8, 26.0), (203.0, 28.2), (204.2, 29.2)]
    i.cavar(rio, 26, 12, suave=10)

    foosha = [(191.5, 26.6), (196.5, 25.4), (201.0, 26.2), (201.8, 29.4), (197.0, 30.6), (192.5, 29.2)]
    i.plato(foosha, 5.0, suave=26)
    i.plato_circular(199.6, 23.0, 1.1, suave=18)
    i.plato_circular(194.6, 22.4, 0.9, suave=16)

    # Gray Terminal: baixio torto encostado na muralha, a leste e sudeste.
    terminal = [(188.4, 19.0), (190.6, 18.8), (192.6, 20.6), (193.0, 23.2), (191.2, 24.6), (188.6, 24.0), (187.4, 22.4)]
    i.plato(terminal, 13, suave=22)

    # ---- materiais --------------------------------------------------------------------
    mata = i.mascara([(186.8, 12.2), (205.6, 13.4), (206.2, 26.5), (201.5, 25.0), (196.5, 24.8), (193.6, 25.6), (193.2, 21.0), (190.8, 17.6), (188.6, 16.5)], 12)
    i.pintar(mata + i.ruido(50, 3) * 0.7, FLORESTA)
    i.pintar(i.circulo(199.6, 23.0, 1.0, 6), GRAMA)
    i.pintar(i.circulo(194.6, 22.4, 0.7, 6), GRAMA)
    i.pintar(i.mascara(terminal, 10) + i.ruido(26, 3) * 0.45, LIXO)
    i.pintar(i.mascara([(191.4, 27.0), (194.0, 26.4), (194.6, 28.9), (192.4, 28.7)], 4), CAMPO)
    i.pintar(i.mascara([(200.8, 28.2), (202.8, 27.4), (203.2, 28.8), (201.6, 29.6)], 4), CAMPO)
    i.pintar(i.linha(rio, 10), RIO)

    i.estrada([(197.8, 30.3), (197.4, 28.6), (195.8, 27.1), (193.8, 25.8), (192.4, 24.4), (190.8, 22.4), (189.4, 20.4)], 8)
    i.estrada([(197.4, 28.6), (198.6, 26.4), (199.2, 24.4), (199.6, 23.0)], 6)
    i.estrada([(198.6, 26.4), (196.2, 23.8), (194.6, 22.4)], 5)
    ruas_foosha = [
        [(193.2, 27.6), (195.4, 27.6), (197.4, 28.6), (199.6, 28.9), (201.2, 28.1)],
        [(195.8, 29.8), (197.8, 30.1), (199.6, 29.9)],
        [(196.0, 26.4), (196.3, 27.6)],
    ]
    for r in ruas_foosha:
        i.estrada(r, 7)

    i.materiais_automaticos(praia=16, rocha_acima=185)
    cidade = i.mascara(anel_irregular(i, cx, cy, 5.5, 0.05, 72, 0.3), 3)
    i.pintar(cidade, CALCADA)
    # jardins do High Town e do palácio
    i.pintar(i.mascara(anel_irregular(i, cx, cy, 2.6, 0.06, 48, 1.1), 3) - i.circulo(cx, cy, 1.25, 3), CAMPINA)

    # ---- Goa ----------------------------------------------------------------------------
    i.obj("muralha", cx, cy, pontos=i.pontos_px(muro_fora), altura=22, espessura=8, torres=16)
    i.obj("portao", cx + 5.33, cy + 0.15, r=0.0, largura=26, altura=30)
    i.obj("muralha", cx, cy, pontos=i.pontos_px(muro_dentro), altura=14, espessura=5, torres=10, cor="clara")
    i.obj("palacio-goa", cx, cy - 0.15, r=math.pi / 2)
    oc.ocupar(cx, cy, 1.55)
    # Avenidas radiais (do portão e das oito direções) cortando os anéis.
    for k in range(8):
        a = k * math.pi / 4 + 0.2
        oc.ocupar(cx + math.cos(a) * 4.3, cy + math.sin(a) * 4.3, 0.28)
        oc.ocupar(cx + math.cos(a) * 3.4, cy + math.sin(a) * 3.4, 0.22)
    for raio, fase, estilo, nivel in ((5.0, 0.3, "goa", (2, 3)), (4.5, 0.3, "goa", (2, 3)), (3.65, 0.8, "goa", (2, 3)), (3.25, 0.8, "goa", (2, 4))):
        casas_na_rua(i, oc, anel_irregular(i, cx, cy, raio, 0.05, 80, fase), "goa", espaco=0.5, recuo=0.0, tamanho=(0.34, 0.5), andares=nivel, falhas=0.04, lados=(1,), costa_min=10)
    for raio in (2.4, 1.95):
        casas_na_rua(i, oc, anel_irregular(i, cx, cy, raio, 0.06, 48, 1.1), "nobre", espaco=0.95, recuo=0.0, tamanho=(0.5, 0.66), andares=(2, 3), falhas=0.25, lados=(1,))
    i.obj("igreja", cx - 2.0, cy + 3.2, r=math.pi / 2)
    i.obj("igreja", cx + 1.2, cy - 3.7, r=math.pi / 2, v=2)

    # ---- Gray Terminal: montanhas de lixo, barracos e fumaça -----------------------------
    espalhar(i, oc, "lixo", 38, (187.6, 19.0, 193.0, 24.6), 0.26)
    espalhar(i, oc, "barraco", 12, (187.8, 19.4, 192.8, 24.2), 0.3)

    # ---- Monte Colubo --------------------------------------------------------------------
    i.obj("casa-dadan", 199.6, 22.9, r=-0.4)
    oc.ocupar(199.6, 22.9, 0.9)
    i.obj("casa-na-arvore", 194.6, 22.3, r=0.6)
    oc.ocupar(194.6, 22.3, 0.8)

    # ---- Vila Foosha ------------------------------------------------------------------------
    i.obj("cais", 198.4, 30.3, pontos=i.pontos_px([(198.3, 30.2), (198.45, 31.55)]), largura=12)
    i.obj("barco", 199.0, 31.35, r=1.45, v=3)
    oc.ocupar(198.4, 30.9, 0.5)
    i.obj("partys-bar", 197.1, 29.55, r=-0.05)
    oc.ocupar(197.1, 29.55, 0.62)
    i.obj("prefeitura", 199.5, 28.25, r=0.1)
    oc.ocupar(199.5, 28.25, 0.55)
    for x, y, r in ((193.3, 26.1, 0.3), (195.2, 25.6, -0.4), (200.4, 26.9, 0.2), (202.3, 27.2, 0.6), (192.4, 28.1, -0.2)):
        i.obj("moinho", x, y, r=r, aplainar=0.5)
        oc.ocupar(x, y, 0.6)
    for r in ruas_foosha:
        casas_na_rua(i, oc, r, "foosha", espaco=0.78, recuo=0.14, tamanho=(0.42, 0.58), andares=(1, 2), falhas=0.18, costa_min=10)
    espalhar(i, oc, "cerca", 6, (191.5, 26.6, 194.5, 29.0), 0.25)
    espalhar(i, oc, "fardo", 10, (191.5, 26.8, 194.4, 28.8), 0.14)
    return i


def shells_town() -> Ilha:
    """Shells Town: a base da Marinha (153ª) no alto — muralha, pátio com o
    poste onde o Zoro ficou amarrado, o prédio com a gaivota e a estátua
    gigante do Morgan no terraço — e a cidade descendo até o porto."""
    i = Ilha(2, "Shells Town", 130, 14, 19.5, 18, semente=23, vegetacao={"palmeiras": 0.03})
    oc = Ocupacao()
    i.contorno([
        (134, 17.6), (137.5, 15.8), (141.5, 15.4), (145.5, 16.4), (148.2, 19.2), (148.6, 23.4),
        (147.4, 27.2), (145.2, 29.6), (143.8, 29.9), (141.8, 29.9), (139.2, 29.2), (136.2, 28.4),
        (133.4, 26.2), (132.0, 22.6), (132.4, 19.6),
    ])
    i.fechar_costa(recorte_px=10, escala_ruido=55)
    i.base(praia=18, planalto=10)
    i.montanha(137.0, 18.6, 2.6, 125, aspereza=0.5)
    i.montanha(146.2, 18.8, 2.2, 95, aspereza=0.5)
    i.montanha(134.4, 24.0, 1.8, 34, aspereza=0.4)
    base = (141.2, 20.6)
    i.plato_circular(base[0], base[1], 3.3, 30, suave=26)
    cidade = [(136.4, 24.4), (140.0, 23.9), (144.6, 24.2), (146.6, 26.4), (145.0, 29.2), (142.6, 29.6), (138.6, 28.8), (135.8, 27.0)]
    i.plato(cidade, 8, suave=30)
    i.pintar(i.mascara([(133, 16), (149, 16), (149, 22.6), (133, 22.6)], 10) + i.ruido(40, 3) * 0.5, FLORESTA)
    i.pintar(i.circulo(base[0], base[1], 3.4, 6), GRAMA)
    i.materiais_automaticos(praia=14, rocha_acima=60)
    i.pintar(i.circulo(base[0], base[1], 3.05, 4), CALCADA)
    # rua principal: do porto até o portão da base
    principal = [(143.0, 29.7), (142.6, 27.4), (141.6, 25.6), (141.2, 24.0)]
    i.estrada(principal, 10, CALCADA)
    ruas = [
        [(137.0, 26.2), (139.4, 26.0), (142.2, 26.2), (145.4, 26.4)],
        [(137.8, 28.0), (140.2, 28.0), (142.4, 28.4), (144.8, 28.2)],
        [(138.6, 24.8), (140.6, 25.0)],
    ]
    for r in ruas:
        i.estrada(r, 7, CALCADA)
    i.obj("base-marinha-153", base[0], base[1], r=math.pi / 2)
    oc.ocupar(base[0], base[1], 3.45)
    oc.ocupar(142.6, 27.4, 0.25)
    for r in ruas + [principal]:
        casas_na_rua(i, oc, r, "shells", espaco=0.62, recuo=0.12, tamanho=(0.4, 0.55), andares=(1, 3), falhas=0.1, costa_min=10)
    i.obj("cais", 143.0, 29.6, pontos=i.pontos_px([(143.0, 29.4), (143.1, 31.0)]), largura=14)
    i.obj("cais", 140.4, 29.2, pontos=i.pontos_px([(140.4, 29.0), (140.0, 30.4)]), largura=9)
    i.obj("barco", 139.5, 30.3, r=1.2, v=2)
    i.obj("barco", 144.0, 30.8, r=1.7, v=5)
    i.obj("farol", 147.6, 27.6, r=0.0, aplainar=0.4)
    oc.ocupar(147.6, 27.6, 0.5)
    return i


def orange_town() -> Ilha:
    """Orange Town: cidade de tijolo alaranjado ocupada pelo Buggy — a faixa
    de casas arrasada pela Bala Buggy, o bar com a bandeira dele no telhado,
    a loja de ração guardada pelo Chouchou e o navio-circo (Big Top) no cais."""
    i = Ilha(3, "Orange Town", 109, 39, 20.5, 14.5, semente=37)
    oc = Ocupacao()
    i.contorno([
        (112.0, 42.6), (115.4, 40.8), (119.6, 40.6), (123.8, 41.2), (127.0, 43.0), (128.4, 46.4),
        (127.6, 49.6), (125.2, 51.8), (123.0, 52.4), (121.4, 52.4), (118.6, 51.6), (115.2, 51.2),
        (112.2, 49.8), (110.6, 46.8),
    ])
    i.fechar_costa(recorte_px=10, escala_ruido=60)
    i.base(praia=18, planalto=10)
    i.montanha(115.0, 43.4, 2.8, 150, aspereza=0.55)
    i.montanha(119.6, 42.4, 2.2, 105, aspereza=0.5)
    i.montanha(126.0, 44.4, 2.0, 46, aspereza=0.45)
    cidade = [(113.4, 46.8), (118.0, 45.6), (124.6, 45.8), (127.0, 48.4), (125.0, 51.4), (121.6, 52.0), (116.0, 50.8), (112.8, 49.4)]
    i.plato(cidade, 7, suave=26)
    i.pintar(i.mascara([(111, 41), (128, 41), (128, 45.4), (111, 45.8)], 8) + i.ruido(40, 3) * 0.5, FLORESTA)
    i.materiais_automaticos(praia=14, rocha_acima=62)
    miolo = [(114.2, 47.0), (118.2, 46.2), (124.2, 46.4), (126.2, 48.6), (124.4, 50.8), (121.4, 51.2), (116.2, 50.2), (113.8, 49.0)]
    # A Bala Buggy passou aqui: a faixa fica reservada (sem casas) para os escombros.
    bala = [(115.0 + k / 8 * 9.0, 49.8 - k / 8 * 2.8) for k in range(9)]
    for x, y in bala:
        oc.ocupar(x, y, 0.62)
    ruas = cidade_em_grade(i, oc, miolo, "orange", angulo=0.12, quadra=1.55, largura_rua=8, espaco=0.6, recuo=0.1, tamanho=(0.4, 0.56), andares=(1, 3), falhas=0.08, costa_min=10)
    # A Bala Buggy: uma faixa reta de casas pulverizadas, de lado a lado da cidade.
    for k, (x, y) in enumerate(bala):
        i.obj("escombros", x, y, r=-0.3, v=k)
    i.obj("bar-buggy", 121.0, 48.0, r=math.pi / 2)
    i.obj("loja-racao", 118.2, 49.6, r=math.pi / 2)
    i.obj("cais", 122.2, 51.8, pontos=i.pontos_px([(122.2, 51.6), (122.3, 53.2)]), largura=12)
    i.obj("navio-buggy", 124.4, 53.0, r=0.0)
    return i


def vila_syrup() -> Ilha:
    """Vila Syrup: a vila no alto, a mansão da Kaya num morro com jardim e
    portão, a ladeira (o declive) que desce até a praia norte onde o bando
    do Kuro desembarcou, penhascos, e o Going Merry atracado."""
    i = Ilha(4, "Vila Syrup", 127, 60, 21.5, 19.5, semente=41, vegetacao={"palmeiras": 0.02})
    oc = Ocupacao()
    i.contorno([
        (130.2, 63.2), (134.0, 61.6), (139.0, 61.2), (143.6, 62.0), (146.8, 64.4), (147.4, 68.2),
        (146.0, 72.2), (143.6, 75.0), (140.6, 76.6), (137.6, 76.8), (134.6, 75.6), (131.6, 73.4),
        (129.4, 69.8), (129.2, 66.0),
    ])
    i.fechar_costa(recorte_px=12, escala_ruido=60)
    i.base(praia=16, planalto=12)
    # planalto da vila e da mansão; penhascos na costa norte com a ladeira até a praia
    i.plato([(131, 64.6), (145.6, 64.4), (146.2, 71.0), (141.0, 75.0), (133.0, 73.6), (130.4, 69.0)], 30, suave=34)
    i.falesia([(130, 60.5), (147, 60.5), (148.5, 64.8), (129, 65.2)], 34, largura_px=26)
    i.montanha(144.2, 67.0, 2.4, 115, aspereza=0.5)
    i.montanha(131.6, 69.0, 2.0, 40, aspereza=0.4)
    mansao = (140.4, 66.6)
    i.plato_circular(mansao[0], mansao[1], 2.0, 44, suave=26)
    vila = [(133.2, 69.4), (137.8, 69.2), (139.4, 72.4), (137.2, 74.6), (134.0, 73.6)]
    i.plato(vila, 28, suave=18)
    i.pintar(i.mascara([(141.6, 64), (147, 64), (147, 72), (143, 74)], 10) + i.ruido(40, 3) * 0.6, FLORESTA)
    i.pintar(i.mascara([(129.6, 66.4), (133.2, 65.6), (133.4, 69.0), (130.4, 70.4)], 8) + i.ruido(40, 3) * 0.5, FLORESTA)
    i.pintar(i.circulo(mansao[0], mansao[1], 1.9, 6), CAMPINA)
    i.pintar(i.mascara([(134.2, 65.4), (137.6, 65.0), (137.8, 67.6), (134.4, 67.8)], 4), CAMPO)
    i.materiais_automaticos(praia=14, rocha_acima=90)
    # A ladeira: da praia norte (já no pé do penhasco) subindo até a vila.
    ladeira = [(136.2, 61.9), (136.4, 63.0), (136.0, 64.2), (135.6, 66.0), (135.4, 68.4), (135.8, 70.4)]
    i.estrada(ladeira, 9)
    ruas = [
        [(133.4, 70.8), (135.8, 70.4), (138.2, 70.8), (139.6, 72.6)],
        [(134.4, 72.8), (136.6, 73.0), (138.4, 74.2), (138.8, 76.2)],
        [(138.2, 70.8), (139.4, 68.2), (mansao[0] - 1.0, mansao[1] + 1.3)],
    ]
    for r in ruas:
        i.estrada(r, 7)
    i.obj("mansao-kaya", mansao[0], mansao[1] - 0.2, r=math.pi / 2)
    oc.ocupar(mansao[0], mansao[1], 2.0)
    oc.ocupar(135.6, 66.0, 0.3)
    for r in ruas:
        casas_na_rua(i, oc, r, "syrup", espaco=0.8, recuo=0.14, tamanho=(0.42, 0.58), andares=(1, 2), falhas=0.18, costa_min=10)
    i.obj("casa-usopp", 132.8, 71.6, r=0.3)
    oc.ocupar(132.8, 71.6, 0.5)
    i.obj("cais", 138.2, 76.4, pontos=i.pontos_px([(138.2, 76.2), (138.4, 77.8)]), largura=12)
    i.obj("going-merry", 140.2, 77.4, r=0.1)
    espalhar(i, oc, "fardo", 8, (134.4, 65.4, 137.6, 67.6), 0.14)
    return i


def baratie() -> Ilha:
    """Baratie: o restaurante flutuante em forma de peixe, parado no meio do
    mar. Não é terra: o casco bloqueia a navegação e balança nas ondas."""
    i = Ilha(5, "Baratie", 100, 42.5, 10, 6.5, semente=53, flutuante=True)
    i.h[:] = -20
    i.costa = i.h.copy()
    i.obj("baratie", 105.0, 46.1, r=0.0)
    i.bloqueio_extra = [(x, y) for x in range(102, 109) for y in range(45, 48)]
    return i


def cocoyashi() -> Ilha:
    """Ilha Cocoyashi (Conomi): o Arlong Park na costa oeste — a torre, a
    muralha e a piscina de água do mar —, a Vila Cocoyashi junto à baía, o
    pomar de tangerinas da Bellemere num morro, palmeiras e as montanhas do
    norte."""
    i = Ilha(6, "Ilha Cocoyashi", 87, 10.5, 26.5, 17.5, semente=67, vegetacao={"palmeiras": 0.07})
    oc = Ocupacao()
    i.contorno([
        (91.0, 12.8), (95.6, 11.8), (101.0, 11.6), (106.4, 12.2), (110.4, 13.8), (112.2, 17.0),
        (111.2, 20.8), (108.8, 23.6), (106.2, 24.0), (104.4, 21.4), (103.0, 19.0), (101.0, 18.8),
        (99.2, 19.2), (97.8, 21.8), (95.6, 25.4), (92.6, 26.2), (89.6, 24.2), (88.4, 20.4), (89.0, 16.0),
    ])
    i.fechar_costa(recorte_px=12, escala_ruido=60)
    i.base(praia=20, planalto=12)
    i.montanha(99.6, 13.8, 3.0, 195, aspereza=0.55, alongar=(1.6, 1.0, 0.1))
    i.montanha(105.4, 14.2, 2.6, 118, aspereza=0.55)
    i.montanha(94.0, 14.6, 2.2, 90, aspereza=0.5)
    arlong = (92.4, 21.4)
    i.plato_circular(arlong[0], arlong[1], 2.6, 7, suave=16)
    vila = [(96.8, 17.2), (100.4, 16.6), (103.4, 17.4), (103.0, 18.6), (99.4, 18.8), (96.6, 19.4)]
    i.plato(vila, 7, suave=22)
    pomar = (108.2, 18.6)
    i.plato_circular(pomar[0], pomar[1], 1.7, 24, suave=30)
    i.pintar(i.mascara([(90, 12.4), (111.6, 12.4), (111.6, 16.4), (90, 16.8)], 10) + i.ruido(40, 3) * 0.5, FLORESTA)
    i.pintar(i.circulo(pomar[0], pomar[1], 1.7, 6), POMAR)
    i.materiais_automaticos(praia=18, rocha_acima=110)
    i.pintar(i.circulo(arlong[0], arlong[1], 2.3, 4), CALCADA)
    ruas = [
        [(97.2, 18.4), (99.6, 17.8), (102.6, 18.0)],
        [(98.0, 17.2), (100.2, 16.8), (101.8, 17.0)],
    ]
    for r in ruas:
        i.estrada(r, 7)
    i.estrada([(102.6, 18.0), (104.6, 18.6), (106.6, 18.8), (pomar[0], pomar[1])], 6)
    i.estrada([(97.2, 18.4), (95.4, 19.6), (arlong[0] + 2.2, arlong[1] - 0.4)], 7)
    i.obj("arlong-park", arlong[0], arlong[1], r=math.pi)
    oc.ocupar(arlong[0], arlong[1], 2.6)
    for r in ruas:
        casas_na_rua(i, oc, r, "cocoyashi", espaco=0.78, recuo=0.14, tamanho=(0.42, 0.56), andares=(1, 2), falhas=0.15, costa_min=10)
    i.obj("casa-bellemere", pomar[0] - 0.2, pomar[1] + 0.9, r=math.pi / 2)
    oc.ocupar(pomar[0] - 0.2, pomar[1] + 0.9, 0.5)
    for k in range(26):
        a = k * 2.399
        r = 0.35 + 1.25 * math.sqrt(k / 26)
        x, y = pomar[0] + math.cos(a) * r, pomar[1] + math.sin(a) * r * 0.8 - 0.2
        if oc.livre(x, y, 0.16):
            oc.ocupar(x, y, 0.16)
            i.obj("tangerineira", x, y, v=k)
    i.obj("cais", 101.0, 18.9, pontos=i.pontos_px([(101.0, 18.7), (101.1, 20.2)]), largura=12)
    i.obj("barco", 100.2, 19.9, r=1.3, v=1)
    i.obj("moinho", 99.4, 16.4, r=-0.2, aplainar=0.45, v=4)
    return i


def loguetown() -> Ilha:
    """Loguetown, a cidade do começo e do fim: cidade grande de prédios altos,
    a praça com o cadafalso onde Gold Roger foi executado, a base da Marinha
    do Smoker junto ao porto, o rio cortando a cidade e as montanhas a
    noroeste."""
    i = Ilha(7, "Loguetown", 63, 50.5, 25.5, 22, semente=71)
    oc = Ocupacao()
    i.contorno([
        (67.4, 54.2), (71.6, 52.2), (76.8, 51.8), (81.6, 52.8), (85.4, 55.4), (87.2, 59.6),
        (86.8, 64.4), (84.6, 68.2), (81.6, 70.6), (79.6, 71.0), (77.0, 70.8), (73.2, 70.2),
        (69.4, 68.4), (66.2, 65.0), (64.6, 60.4), (65.2, 56.6),
    ])
    i.fechar_costa(recorte_px=12, escala_ruido=70)
    i.base(praia=18, planalto=12)
    i.montanha(69.0, 56.6, 3.4, 170, aspereza=0.55, alongar=(1.3, 1.0, -0.5))
    i.montanha(74.0, 54.8, 2.4, 105, aspereza=0.5)
    i.montanha(66.8, 61.4, 2.0, 70, aspereza=0.45)
    cidade = [(71.0, 60.2), (77.0, 57.4), (83.6, 57.2), (86.0, 60.6), (85.2, 65.4), (82.4, 69.4), (78.6, 70.4), (73.4, 69.4), (69.4, 66.6)]
    i.plato(cidade, 9, suave=30)
    rio = [(73.6, 58.6), (74.4, 61.4), (74.2, 64.2), (73.0, 67.0), (71.4, 69.6)]
    i.cavar(rio, 30, 7, suave=8)
    praca = (79.6, 63.6)
    i.plato_circular(praca[0], praca[1], 1.9, 9, suave=12)
    i.pintar(i.mascara([(65, 53.4), (78, 52.2), (76, 57.6), (70.6, 60.4), (66, 64.6)], 10) + i.ruido(40, 3) * 0.5, FLORESTA)
    i.pintar(i.linha(rio, 12), RIO)
    i.materiais_automaticos(praia=14, rocha_acima=120)
    i.pintar(i.circulo(praca[0], praca[1], 1.8, 3), CALCADA)
    oc.ocupar(praca[0], praca[1], 1.9)
    marinha = (83.2, 67.2)
    oc.ocupar(marinha[0], marinha[1], 1.4)
    for k in range(5):
        oc.ocupar(74.2 - k * 0.1, 59.4 + k * 2.1, 0.55)  # beira do rio livre
    miolo = [(75.2, 59.4), (83.2, 58.4), (85.6, 61.0), (84.8, 65.2), (81.4, 69.0), (76.2, 69.4), (75.4, 65.0)]
    cidade_em_grade(i, oc, miolo, "logue", angulo=-0.08, quadra=1.35, largura_rua=8, espaco=0.52, recuo=0.05, tamanho=(0.38, 0.52), andares=(3, 5), falhas=0.05, costa_min=10)
    oeste = [(70.6, 62.0), (73.0, 60.8), (73.0, 67.6), (70.4, 67.0)]
    cidade_em_grade(i, oc, oeste, "logue", angulo=-0.08, quadra=1.35, largura_rua=7, espaco=0.55, recuo=0.05, tamanho=(0.38, 0.52), andares=(2, 4), falhas=0.1, costa_min=10)
    i.obj("cadafalso", praca[0], praca[1] - 0.2, r=math.pi / 2)
    i.obj("base-marinha-logue", marinha[0], marinha[1], r=math.pi / 2)
    i.obj("ponte", 74.3, 62.6, r=0.0, comprimento=36)
    i.obj("ponte", 73.6, 66.2, r=0.2, comprimento=36)
    i.obj("cais", 79.4, 70.6, pontos=i.pontos_px([(79.4, 70.4), (79.5, 72.0)]), largura=14)
    i.obj("cais", 82.2, 69.6, pontos=i.pontos_px([(82.2, 69.4), (82.8, 71.0)]), largura=12)
    i.obj("cais", 76.2, 70.5, pontos=i.pontos_px([(76.2, 70.3), (75.9, 71.8)]), largura=10)
    i.obj("barco", 77.4, 71.4, r=1.6, v=6)
    i.obj("barco", 81.2, 71.0, r=1.4, v=7)
    i.obj("farol", 86.2, 64.8, r=0.0, aplainar=0.45)
    return i


def todas() -> list[Ilha]:
    return [dawn(), shells_town(), orange_town(), vila_syrup(), baratie(), cocoyashi(), loguetown()]
