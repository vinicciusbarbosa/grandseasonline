using SugoiGame.Application.Common;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Application.Auth;

public interface IAutenticacaoService
{
    Task<Result<ResultadoAutenticacao>> LoginAsync(LoginRequest request, CancellationToken ct = default);

    Task<Result<ResultadoAutenticacao>> RegistrarAsync(RegistrarRequest request, CancellationToken ct = default);

    /// <summary>Invalida o token de sessão gravado na conta, derrubando também a sessão do PHP.</summary>
    Task<Result> LogoutAsync(int contaId, CancellationToken ct = default);

    /// <summary>
    /// Valida o par (conta, token) vindo dos cookies. É o mesmo par que o PHP
    /// grava em <c>sg_c</c>/<c>sg_k</c>.
    /// </summary>
    Task<Conta?> ValidarSessaoAsync(int contaId, string token, CancellationToken ct = default);

    Task<Result<SessaoDto>> ObterSessaoAsync(int contaId, CancellationToken ct = default);
}
