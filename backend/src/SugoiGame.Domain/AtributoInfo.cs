using SugoiGame.Domain.Enums;

namespace SugoiGame.Domain;

/// <summary>
/// Rótulo e efeito de um atributo, para o front não precisar duplicar o texto.
/// Portado de nome_atributo() e descricao_atributo() em Funcoes/atributos.php.
/// </summary>
/// <param name="Sigla">Nome curto, igual ao nome da coluna em <c>tb_personagens</c>.</param>
public record AtributoInfo(Atributo Atributo, string Sigla, string Nome, string Descricao)
{
    private static readonly IReadOnlyDictionary<Atributo, AtributoInfo> PorAtributo = new AtributoInfo[]
    {
        new(Atributo.Atk, "atk", "Ataque",
            "Cada ponto aumenta o dano causado pelo personagem em 10."),
        new(Atributo.Def, "def", "Defesa",
            "Cada ponto diminui o dano sofrido pelo personagem em 10."),
        new(Atributo.Agl, "agl", "Agilidade",
            "Cada ponto aumenta sua chance de se esquivar do ataque inimigo em 1%. A chance máxima de esquiva é 50%."),
        new(Atributo.Res, "res", "Resistência",
            "Cada ponto aumenta sua chance de bloquear o ataque inimigo em 1%. Um bloqueio reduz o dano sofrido em 90%. A chance máxima de bloqueio é 50%."),
        new(Atributo.Pre, "pre", "Precisão",
            "Cada ponto reduz em 1% a chance do inimigo se esquivar do seu ataque."),
        new(Atributo.Dex, "dex", "Destreza",
            "Cada ponto aumenta em 1% sua chance de acerto crítico e em 1% o dano crítico. Máximos: 50% de chance e 90% de dano."),
        new(Atributo.Con, "con", "Percepção",
            "Cada ponto reduz em 1% a chance do inimigo te acertar um crítico, em 1% o dano crítico sofrido e em 1% a chance do inimigo bloquear seu ataque."),
        new(Atributo.Vit, "vit", "Vitalidade",
            "Cada ponto aumenta seu HP em 50. O bônus de vitalidade vindo de itens ou habilidades só é calculado durante combates."),
    }.ToDictionary(a => a.Atributo);

    public static IReadOnlyList<AtributoInfo> Todos { get; } = [.. PorAtributo.Values];

    public static AtributoInfo De(Atributo atributo) => PorAtributo[atributo];
}
