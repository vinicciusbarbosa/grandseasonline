using SugoiGame.Domain.Enums;

namespace SugoiGame.Domain.Entities;

/// <summary>
/// Uma pilha de itens no inventário da tripulação. Mapeia <c>tb_usuario_itens</c>.
/// </summary>
/// <remarks>
/// A tabela é polimórfica: <see cref="Tipo"/> diz em qual tabela de detalhe
/// procurar <see cref="CodItem"/>. Não há FK para essas tabelas — a integridade
/// depende do código.
/// <para>
/// A capacidade do inventário é contada em <i>linhas</i>, não em unidades: uma
/// pilha de 50 balas de canhão ocupa um espaço só. É assim no legado
/// (<c>count($items)</c> em Scripts/Inventario/inventario.php) e foi mantido.
/// </para>
/// </remarks>
public class ItemInventario
{
    /// <summary>Chave primária. A coluna legada se chama <c>okok</c>.</summary>
    public int Id { get; set; }

    /// <summary>FK para a tripulação dona (coluna <c>id</c> no schema legado).</summary>
    public int TripulacaoId { get; set; }

    /// <summary>Identificador do item dentro da tabela de detalhe do seu tipo.</summary>
    public int CodItem { get; set; }

    public TipoItem Tipo { get; set; }

    public int Quantidade { get; set; } = 1;

    /// <summary>Marca o item como recém-adquirido, para o front destacá-lo.</summary>
    public bool Novo { get; set; } = true;

    public Tripulacao Tripulacao { get; set; } = null!;
}
