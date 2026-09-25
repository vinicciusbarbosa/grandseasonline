namespace SugoiGame.Api.Autenticacao;

/// <summary>
/// Como os cookies de sessão são gravados. Os padrões reproduzem o
/// <c>setcookie()</c> do PHP em Classes/UserDetails.php.
/// </summary>
public class OpcoesCookieSessao
{
    public const string Secao = "CookiesSessao";

    /// <summary>
    /// Domínio dos cookies. Nulo (padrão) grava para o host atual, que é o
    /// suficiente quando PHP e API respondem no mesmo hostname.
    /// </summary>
    public string? Dominio { get; set; }

    /// <summary>
    /// Exigir HTTPS. O PHP gravava com secure = FALSE; em produção isso deve ser
    /// verdadeiro dos dois lados.
    /// </summary>
    public bool ApenasHttps { get; set; }

    public TimeSpan Duracao { get; set; } = TimeSpan.FromSeconds(80000);

    /// <summary>Origens do front autorizadas a chamar a API com credenciais.</summary>
    public string[] OrigensPermitidas { get; set; } = ["http://localhost:5173"];
}
