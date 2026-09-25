using SugoiGame.Application.Common;
using SugoiGame.Domain.Enums;

namespace SugoiGame.Application.Equipamentos;

public interface IEquipamentoService
{
    Task<Result<EquipamentosDoPersonagemDto>> ObterDoPersonagemAsync(
        int tripulacaoId,
        int personagemCod,
        CancellationToken ct = default);

    Task<Result<EquipamentosDoPersonagemDto>> EquiparAsync(
        int tripulacaoId,
        int personagemCod,
        EquiparRequest request,
        CancellationToken ct = default);

    Task<Result<EquipamentosDoPersonagemDto>> DesequiparAsync(
        int tripulacaoId,
        int personagemCod,
        SlotEquipamento slot,
        CancellationToken ct = default);
}
