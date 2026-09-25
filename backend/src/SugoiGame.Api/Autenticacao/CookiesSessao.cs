using Microsoft.Extensions.Options;

namespace SugoiGame.Api.Autenticacao;

/// <summary>
/// Grava e limpa os cookies de sessão no mesmo formato do PHP, de modo que
/// logar pela API também loga no jogo legado — e deslogar derruba os dois.
/// </summary>
public class CookiesSessao(IOptions<OpcoesCookieSessao> opcoes)
{
    private readonly OpcoesCookieSessao _opcoes = opcoes.Value;

    public void Gravar(HttpResponse response, int contaId, string token)
    {
        var expiracao = DateTimeOffset.UtcNow.Add(_opcoes.Duracao);

        response.Cookies.Append(SessaoLegado.CookieConta, contaId.ToString(), Opcoes(expiracao));
        response.Cookies.Append(SessaoLegado.CookieToken, token, Opcoes(expiracao));

        // O contador de mensagens não lidas do chat legado começa zerado.
        response.Cookies.Append(SessaoLegado.CookieChat, "0", Opcoes(expiracao));
    }

    public void Limpar(HttpResponse response)
    {
        foreach (var nome in (string[])[SessaoLegado.CookieConta, SessaoLegado.CookieToken, SessaoLegado.CookieChat])
        {
            response.Cookies.Delete(nome, Opcoes(DateTimeOffset.UnixEpoch));
        }
    }

    private CookieOptions Opcoes(DateTimeOffset expiracao) => new()
    {
        HttpOnly = true,
        Secure = _opcoes.ApenasHttps,
        Path = "/",
        Domain = _opcoes.Dominio,
        Expires = expiracao,

        // Lax basta: o front e o PHP moram no mesmo site (a porta não conta para
        // same-site). Strict quebraria a volta de fluxos externos como o do Facebook.
        SameSite = SameSiteMode.Lax,
    };
}
