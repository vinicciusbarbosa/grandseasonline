using System.Security.Claims;
using SugoiGame.Application.Abstractions;

namespace SugoiGame.Api.Autenticacao;

/// <summary>Lê a identidade da requisição corrente a partir das claims.</summary>
public class UsuarioAtual(IHttpContextAccessor acessor) : IUsuarioAtual
{
    public int? ContaId => LerClaimInt(SessaoLegado.ClaimContaId);

    public int? TripulacaoId => LerClaimInt(SessaoLegado.ClaimTripulacaoId);

    public bool EstaAutenticado => ContaId is not null;

    private int? LerClaimInt(string tipo)
    {
        var valor = acessor.HttpContext?.User.FindFirstValue(tipo);

        return int.TryParse(valor, out var numero) ? numero : null;
    }
}
