using SugoiGame.Application.Inventario;
using SugoiGame.Domain.Enums;

namespace SugoiGame.Application.Equipamentos;

/// <summary>Uma posição do corpo, ocupada ou vazia.</summary>
/// <param name="EspelhaArmaDeDuasMaos">
/// Verdadeiro na segunda mão quando ela apenas reflete a arma de duas mãos
/// segurada pela primeira — o front mostra a peça, mas não a conta duas vezes.
/// </param>
public record SlotEquipadoDto(
    SlotEquipamento Slot,
    string SlotNome,
    string? Nome,
    string? Descricao,
    int Img,
    EquipamentoDto? Equipamento,
    bool EspelhaArmaDeDuasMaos);

public record EquipamentosDoPersonagemDto(
    int PersonagemCod,
    IReadOnlyList<SlotEquipadoDto> Slots);

/// <param name="SlotDestino">
/// Só é considerado para armas de uma mão, que cabem na primeira ou na segunda.
/// Para as demais peças o destino vem do próprio item.
/// </param>
public record EquiparRequest(int CodEquipamento, SlotEquipamento? SlotDestino = null);
