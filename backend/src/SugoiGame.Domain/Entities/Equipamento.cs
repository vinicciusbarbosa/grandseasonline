using SugoiGame.Domain.Enums;

namespace SugoiGame.Domain.Entities;

/// <summary>
/// Uma peça de equipamento. Mapeia <c>tb_item_equipamentos</c>.
/// </summary>
/// <remarks>
/// Cada linha é uma <i>instância</i> única: dois jogadores com "a mesma espada"
/// têm dois <see cref="Cod"/> diferentes. O agrupamento por modelo é feito por
/// <see cref="ItemBase"/>, que é também a chave usada pelo treino em
/// <c>tb_personagem_equip_treino</c>.
/// <para>
/// A tabela vem vazia nos seeds do repositório porque as instâncias nascem em
/// runtime (forja, drops de combate, loja).
/// </para>
/// </remarks>
public class Equipamento
{
    /// <summary>Chave primária da instância (coluna <c>cod_equipamento</c>).</summary>
    public int Cod { get; set; }

    /// <summary>Modelo do equipamento (coluna <c>item</c>). Agrupa instâncias iguais.</summary>
    public int ItemBase { get; set; }

    public string Nome { get; set; } = string.Empty;

    public string Descricao { get; set; } = string.Empty;

    public int Img { get; set; }

    /// <summary>Categoria do dano causado pela arma.</summary>
    public int CategoriaDano { get; set; }

    /// <summary>Atributo que recebe o bônus principal. 0 quando não há.</summary>
    public int BonusPrimarioAtributo { get; set; }

    /// <summary>Atributo que recebe o bônus secundário. 0 quando não há.</summary>
    public int BonusSecundarioAtributo { get; set; }

    /// <summary>
    /// Raridade. Quanto maior, mais forte: ela entra como divisor invertido na
    /// fórmula de bônus, então subir a categoria aumenta o efeito.
    /// </summary>
    public int Categoria { get; set; }

    /// <summary>Nível mínimo do personagem para equipar.</summary>
    public int Lvl { get; set; }

    public int Upgrade { get; set; }

    public int TreinoMax { get; set; }

    /// <summary>Onde a peça é vestida, ou a exigência de mãos para armas.</summary>
    public SlotEquipamento Slot { get; set; }

    /// <summary>Classe exigida do personagem. 0 significa qualquer classe.</summary>
    public int Requisito { get; set; }

    /// <summary>Armas de duas mãos rendem o dobro de bônus, já que ocupam dois slots.</summary>
    private decimal MultiplicadorDeSlot => Slot == SlotEquipamento.DuasMaos ? 2m : 1m;

    /// <summary>
    /// Bônus aplicado ao atributo primário.
    /// Portado de calc_bonus_equip_atr_principal() em Funcoes/equipamentos.php.
    /// </summary>
    public decimal CalcularBonusPrimario() => CalcularBonus(divisorBase: 10);

    /// <summary>
    /// Bônus aplicado ao atributo secundário — mesma fórmula do primário, com um
    /// divisor uma unidade maior, o que o torna sempre menor.
    /// </summary>
    public decimal CalcularBonusSecundario() => CalcularBonus(divisorBase: 11);

    private decimal CalcularBonus(int divisorBase)
    {
        var divisor = divisorBase - Categoria;

        // O PHP dividia direto e estouraria com DivisionByZeroError numa categoria
        // igual ao divisor base. Aqui um dado inconsistente vira bônus zero em vez
        // de derrubar a requisição.
        if (divisor <= 0)
        {
            return 0m;
        }

        var efeito = (decimal)(Lvl + Upgrade) / divisor;

        return ArredondarComoPhp(efeito * MultiplicadorDeSlot);
    }

    /// <summary>
    /// O round() do PHP arredonda 0,5 para longe do zero; o padrão do .NET é
    /// arredondamento bancário. Sem isso os bônus divergiriam do legado.
    /// </summary>
    internal static decimal ArredondarComoPhp(decimal valor) =>
        Math.Round(valor, 2, MidpointRounding.AwayFromZero);
}
