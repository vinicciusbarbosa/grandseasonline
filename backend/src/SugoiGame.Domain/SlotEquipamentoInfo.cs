using SugoiGame.Domain.Enums;

namespace SugoiGame.Domain;

/// <summary>
/// Nome exibível de cada slot. Portado de nome_slot() em
/// public/Funcoes/equipamentos.php — com "Duas mâos" corrigido para "Duas mãos".
/// </summary>
public static class SlotEquipamentoInfo
{
    private static readonly Dictionary<SlotEquipamento, string> Nomes = new()
    {
        [SlotEquipamento.Cabeca] = "Cabeça",
        [SlotEquipamento.Colete] = "Colete",
        [SlotEquipamento.Calcas] = "Calças",
        [SlotEquipamento.Botas] = "Botas",
        [SlotEquipamento.Luvas] = "Luvas",
        [SlotEquipamento.Capa] = "Capa",
        [SlotEquipamento.PrimeiraMao] = "Primeira mão",
        [SlotEquipamento.SegundaMao] = "Segunda mão",
        [SlotEquipamento.UmaMao] = "Uma mão",
        [SlotEquipamento.DuasMaos] = "Duas mãos",
    };

    public static string Nome(SlotEquipamento slot) => Nomes.GetValueOrDefault(slot, string.Empty);

    /// <summary>
    /// Onde um item pode ser vestido. Armas dizem a exigência de mãos em vez da
    /// posição, então uma de uma mão aceita as duas mãos e uma de duas mãos
    /// ocupa a primeira (espelhando na segunda).
    /// </summary>
    public static IReadOnlyList<SlotEquipamento> DestinosPossiveis(SlotEquipamento exigencia) => exigencia switch
    {
        SlotEquipamento.UmaMao => [SlotEquipamento.PrimeiraMao, SlotEquipamento.SegundaMao],
        SlotEquipamento.DuasMaos => [SlotEquipamento.PrimeiraMao],
        _ => [exigencia],
    };
}
