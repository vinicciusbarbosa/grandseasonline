using SugoiGame.Application.Abstractions;

namespace SugoiGame.Api.Endpoints;

internal static class SessaoJogo
{
    /// <summary>
    /// Estas rotas operam sobre a tripulação ativa. Uma conta recém-criada ainda
    /// não escolheu nenhuma — nesse caso o front precisa mandar o jogador para a
    /// tela de seleção, e não tratar como erro de autenticação.
    /// </summary>
    public static IResult? ExigirTripulacao(IUsuarioAtual usuario) => usuario.TripulacaoId is null
        ? Results.Problem(
            detail: "Selecione uma tripulação antes de continuar.",
            statusCode: StatusCodes.Status409Conflict,
            title: "Nenhuma tripulação ativa",
            extensions: new Dictionary<string, object?> { ["codigo"] = "sem_tripulacao_ativa" })
        : null;
}
