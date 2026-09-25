using SugoiGame.Domain;
using SugoiGame.Domain.Entities;
using SugoiGame.Domain.Enums;

namespace SugoiGame.Application.Inventario;

internal static class MapeamentosItem
{
    public static EquipamentoDto ParaDto(this Equipamento equipamento) => new(
        equipamento.Cod,
        equipamento.ItemBase,
        equipamento.Categoria,
        equipamento.Lvl,
        equipamento.Upgrade,
        equipamento.Slot,
        SlotEquipamentoInfo.Nome(equipamento.Slot),
        equipamento.Requisito,
        equipamento.CategoriaDano,
        BonusDto(equipamento.BonusPrimarioAtributo, equipamento.CalcularBonusPrimario()),
        BonusDto(equipamento.BonusSecundarioAtributo, equipamento.CalcularBonusSecundario()));

    public static ItemInventarioDto ParaDto(this ItemInventario item, DetalheItem detalhe) => new(
        item.Id,
        item.Tipo,
        item.CodItem,
        item.Quantidade,
        item.Novo,
        detalhe.Nome,
        detalhe.Descricao,
        detalhe.Img,
        detalhe.Formato,
        detalhe.Equipamento?.ParaDto());

    private static BonusEquipamentoDto? BonusDto(int indiceAtributo, decimal valor)
    {
        if (indiceAtributo == 0 || !Enum.IsDefined(typeof(Atributo), indiceAtributo))
        {
            return null;
        }

        var info = AtributoInfo.De((Atributo)indiceAtributo);

        return new BonusEquipamentoDto(info.Atributo, info.Sigla, info.Nome, valor);
    }
}
