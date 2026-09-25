namespace SugoiGame.Domain.Entities;

/// <summary>
/// Reagente de profissão. Mapeia <c>tb_item_reagents</c> — a única tabela de
/// detalhe de item que vem populada nos seeds do repositório (185 linhas).
/// </summary>
public class Reagente
{
    public int Cod { get; set; }

    public string Nome { get; set; } = string.Empty;

    public string Descricao { get; set; } = string.Empty;

    public int Img { get; set; }

    /// <summary>Extensão do sprite. Alguns reagentes usam jpg em vez de png.</summary>
    public string? ImgFormato { get; set; }

    public long Preco { get; set; }
}

/// <summary>
/// Item de missão. Mapeia <c>tb_item_missao</c>.
/// </summary>
public class ItemDeMissao
{
    public long Id { get; set; }

    public string? Nome { get; set; }

    public string? Descricao { get; set; }

    public int? Img { get; set; }

    public string? ImgFormato { get; set; }
}
