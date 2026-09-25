using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using SugoiGame.Application.Auth;

namespace SugoiGame.Api.Autenticacao;

/// <summary>
/// Autentica a requisição a partir dos cookies de sessão do jogo legado.
/// Ver <see cref="SessaoLegado"/> para o porquê deste esquema.
/// </summary>
public class SugoiCookieHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IAutenticacaoService autenticacao) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var contaBruta = Request.Cookies[SessaoLegado.CookieConta];
        var token = Request.Cookies[SessaoLegado.CookieToken];

        if (string.IsNullOrWhiteSpace(contaBruta) || string.IsNullOrWhiteSpace(token))
        {
            return AuthenticateResult.NoResult();
        }

        // O PHP grava o id vindo do MySQL, que é zerofill: o cookie costuma vir
        // como "00000000123". int.Parse lida com os zeros à esquerda.
        if (!int.TryParse(contaBruta, out var contaId))
        {
            return AuthenticateResult.NoResult();
        }

        var conta = await autenticacao.ValidarSessaoAsync(contaId, token, Context.RequestAborted);
        if (conta is null)
        {
            return AuthenticateResult.Fail("Sessão inválida ou expirada.");
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, conta.Id.ToString()),
            new(ClaimTypes.Name, conta.Nome),
            new(SessaoLegado.ClaimContaId, conta.Id.ToString()),
        };

        if (conta.TripulacaoAtivaId is { } tripulacaoId)
        {
            claims.Add(new Claim(SessaoLegado.ClaimTripulacaoId, tripulacaoId.ToString()));
        }

        var identidade = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identidade);

        return AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name));
    }
}
