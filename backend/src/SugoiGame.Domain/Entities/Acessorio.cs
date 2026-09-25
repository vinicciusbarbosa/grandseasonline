namespace SugoiGame.Domain.Entities;

/// <summary>
/// Acessório equipado por um personagem. Mapeia <c>tb_item_acessorio</c>.
/// </summary>
/// <remarks>
/// Diferente dos equipamentos, o acessório não tem slot: o personagem usa um só,
/// apontado por <c>tb_personagens.cod_acessorio</c>, e ele concede um bônus fixo
/// em um único atributo.
/// </remarks>
public class Acessorio
{
    public int Cod { get; set; }

    public string Nome { get; set; } = string.Empty;

    public string Descricao { get; set; } = string.Empty;

    /// <summary>Atributo beneficiado, de 1 a 8.</summary>
    public int BonusAtributo { get; set; }

    /// <summary>Quantidade somada ao atributo — valor fixo, não depende de nível.</summary>
    public int BonusQuantidade { get; set; }

    public int Img { get; set; }

    /// <summary>Profundidade de mergulho que o acessório permite.</summary>
    public int Mergulho { get; set; }
}
