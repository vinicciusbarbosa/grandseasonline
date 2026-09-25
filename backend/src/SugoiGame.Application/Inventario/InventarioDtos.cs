using SugoiGame.Domain.Enums;

namespace SugoiGame.Application.Inventario;

/// <summary>Dados de um equipamento, quando a pilha for do tipo Equipamento.</summary>
public record EquipamentoDto(
    int Cod,
    int ItemBase,
    int Categoria,
    int Lvl,
    int Upgrade,
    SlotEquipamento Slot,
    string SlotNome,
    int Requisito,
    int CategoriaDano,
    BonusEquipamentoDto? BonusPrimario,
    BonusEquipamentoDto? BonusSecundario);

/// <param name="Sigla">Nome curto do atributo, igual ao da coluna em <c>tb_personagens</c>.</param>
public record BonusEquipamentoDto(Atributo Atributo, string Sigla, string Nome, decimal Valor);

/// <summary>Uma pilha do inventário, já com o detalhe do seu tipo resolvido.</summary>
public record ItemInventarioDto(
    int Id,
    TipoItem Tipo,
    int CodItem,
    int Quantidade,
    bool Novo,
    string Nome,
    string Descricao,
    int Img,
    string ImgFormato,
    EquipamentoDto? Equipamento);

/// <param name="Capacidade">
/// Quantas pilhas cabem no porão. É zero quando a tripulação ainda não tem
/// navio — e nesse estado o legado bloqueia até desequipar.
/// </param>
public record InventarioDto(
    IReadOnlyList<ItemInventarioDto> Itens,
    int Ocupado,
    int Capacidade,
    bool TemNavio);
