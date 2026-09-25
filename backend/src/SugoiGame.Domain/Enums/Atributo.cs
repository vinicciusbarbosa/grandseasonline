namespace SugoiGame.Domain.Enums;

/// <summary>
/// Os 8 atributos primários de um personagem.
/// </summary>
/// <remarks>
/// No PHP o nome do atributo chegava como string na querystring e era
/// concatenado direto no UPDATE (Scripts/Personagem/adiciona_atributo.php),
/// o que permitia escrever em qualquer coluna de tb_personagens. Aqui o
/// conjunto é fechado por construção.
/// </remarks>
public enum Atributo
{
    /// <summary>Ataque.</summary>
    Atk = 1,

    /// <summary>Defesa.</summary>
    Def = 2,

    /// <summary>Agilidade.</summary>
    Agl = 3,

    /// <summary>Resistência.</summary>
    Res = 4,

    /// <summary>Precisão.</summary>
    Pre = 5,

    /// <summary>Destreza.</summary>
    Dex = 6,

    /// <summary>Percepção.</summary>
    Con = 7,

    /// <summary>Vitalidade — o único que também aumenta HP e MP.</summary>
    Vit = 8,
}
