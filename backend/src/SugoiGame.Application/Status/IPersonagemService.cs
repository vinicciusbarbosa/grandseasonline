using SugoiGame.Application.Common;

namespace SugoiGame.Application.Status;

public interface IPersonagemService
{
    Task<Result<IReadOnlyList<PersonagemStatusDto>>> ListarDaTripulacaoAsync(int tripulacaoId, CancellationToken ct = default);

    Task<Result<PersonagemStatusDto>> ObterAsync(int tripulacaoId, int cod, CancellationToken ct = default);

    Task<Result<PersonagemStatusDto>> DistribuirPontosAsync(
        int tripulacaoId,
        int cod,
        DistribuirPontosRequest request,
        CancellationToken ct = default);

    Task<Result<PersonagemStatusDto>> EvoluirAsync(int tripulacaoId, int cod, CancellationToken ct = default);
}
