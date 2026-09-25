using SugoiGame.Application.Auth;
using SugoiGame.Application.Common;

namespace SugoiGame.Application.Tripulacoes;

public interface ITripulacaoService
{
    Task<Result<IReadOnlyList<TripulacaoResumoDto>>> ListarAsync(int contaId, CancellationToken ct = default);

    /// <summary>Torna uma tripulação da conta a ativa — equivalente ao seltrip do PHP.</summary>
    Task<Result<SessaoDto>> SelecionarAsync(int contaId, int tripulacaoId, CancellationToken ct = default);

    Task<Result<SessaoDto>> CriarAsync(int contaId, CriarTripulacaoRequest request, CancellationToken ct = default);
}
