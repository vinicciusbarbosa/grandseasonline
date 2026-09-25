namespace SugoiGame.Api.Autenticacao;

/// <summary>
/// Contrato de sessão compartilhado com o jogo em PHP.
/// </summary>
/// <remarks>
/// Esta é a peça que permite as duas aplicações rodarem lado a lado: o PHP
/// autentica lendo os cookies <c>sg_c</c> (id da conta) e <c>sg_k</c> (token) e
/// comparando o token com <c>tb_conta.cookie</c>. A API faz exatamente o mesmo,
/// então uma sessão aberta de um lado vale no outro.
/// <para>
/// Cookies ignoram porta: em desenvolvimento, PHP em localhost:80, API em
/// localhost:5080 e React em localhost:5173 compartilham os mesmos cookies sem
/// configuração extra.
/// </para>
/// <para>
/// Quando o PHP for aposentado, este esquema pode dar lugar a algo mais robusto
/// (token opaco com rotação, ou JWT). Até lá, mudar o formato aqui quebra o
/// legado.
/// </para>
/// </remarks>
public static class SessaoLegado
{
    public const string EsquemaAutenticacao = "SugoiCookie";

    /// <summary>Cookie com o id da conta.</summary>
    public const string CookieConta = "sg_c";

    /// <summary>Cookie com o token de sessão, comparado com <c>tb_conta.cookie</c>.</summary>
    public const string CookieToken = "sg_k";

    /// <summary>
    /// Cookie lido pelo servidor de chat em Node (servers/chat). O PHP o grava
    /// junto no login, então a API grava também para não quebrar o chat legado.
    /// </summary>
    public const string CookieChat = "chat";

    public const string ClaimContaId = "sugoi:conta_id";

    public const string ClaimTripulacaoId = "sugoi:tripulacao_id";
}
