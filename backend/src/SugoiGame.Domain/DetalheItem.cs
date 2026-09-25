using SugoiGame.Domain.Entities;
using SugoiGame.Domain.Enums;

namespace SugoiGame.Domain;

/// <summary>
/// A parte apresentável de um item do inventário, resolvida a partir da tabela
/// de detalhe correspondente ao seu <see cref="TipoItem"/>.
/// </summary>
/// <remarks>
/// O legado monta isso com um JOIN polimórfico
/// (<c>get_many_results_joined_mapped_by_type</c>) mais uma série de blocos
/// especiais em Scripts/Inventario/inventario.php. Aqui o mesmo papel é feito
/// pelo repositório de detalhes, que consulta cada tabela e devolve este record.
/// </remarks>
/// <param name="Formato">Extensão do sprite. Algumas tabelas guardam "jpg" em vez de "png".</param>
/// <param name="Equipamento">Preenchido apenas para <see cref="TipoItem.Equipamento"/>.</param>
public record DetalheItem(
    string Nome,
    string Descricao,
    int Img,
    string Formato = "png",
    Equipamento? Equipamento = null)
{
    /// <summary>Usado quando o item existe no inventário mas sumiu da tabela de detalhe.</summary>
    public static DetalheItem Desconhecido(TipoItem tipo, int cod) => new(
        $"Item desconhecido ({tipo})",
        $"Este item está no inventário mas não foi encontrado na tabela de {tipo}. Código {cod}.",
        Img: 0);

    /// <summary>
    /// Itens que o legado descreve direto no código, sem tabela de detalhe
    /// (blocos finais de Scripts/Inventario/inventario.php).
    /// </summary>
    public static DetalheItem? Embutido(TipoItem tipo) => tipo switch
    {
        TipoItem.BalaDeCanhao => new DetalheItem(
            "Bala de canhão",
            "Usada no canhão do navio para batalhas em alto mar.",
            Img: 168),

        TipoItem.IscaNormal => new DetalheItem(
            "Isca",
            "Tem 30% de chance de iniciar uma batalha contra uma criatura marítima quando usada. "
            + "Não pode ser usada logo após ser atingido por disparos de canhões. Consumível, não acumulativo.",
            Img: 370),

        TipoItem.IscaDourada => new DetalheItem(
            "Isca Dourada",
            "Tem 100% de chance de iniciar uma batalha contra uma criatura marítima quando usada. "
            + "Não pode ser usada logo após ser atingido por disparos de canhões. Consumível, não acumulativo.",
            Img: 371),

        _ => null,
    };
}
