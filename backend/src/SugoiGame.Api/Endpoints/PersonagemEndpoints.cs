using SugoiGame.Api.Extensoes;
using SugoiGame.Application.Abstractions;
using SugoiGame.Application.Status;

namespace SugoiGame.Api.Endpoints;

public static class PersonagemEndpoints
{
    public static IEndpointRouteBuilder MapPersonagemEndpoints(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/personagens")
            .WithTags("Personagens")
            .RequireAuthorization();

        grupo.MapGet("/", async (
            IPersonagemService personagens,
            IUsuarioAtual usuario,
            CancellationToken ct) =>
        {
            if (SessaoJogo.ExigirTripulacao(usuario) is { } problema)
            {
                return problema;
            }

            var resultado = await personagens.ListarDaTripulacaoAsync(usuario.TripulacaoId!.Value, ct);

            return resultado.ParaHttp();
        })
        .WithName("ListarPersonagens")
        .WithSummary("Personagens ativos da tripulação selecionada.");

        grupo.MapGet("/{cod:int}", async (
            int cod,
            IPersonagemService personagens,
            IUsuarioAtual usuario,
            CancellationToken ct) =>
        {
            if (SessaoJogo.ExigirTripulacao(usuario) is { } problema)
            {
                return problema;
            }

            var resultado = await personagens.ObterAsync(usuario.TripulacaoId!.Value, cod, ct);

            return resultado.ParaHttp();
        })
        .WithName("ObterPersonagem")
        .WithSummary("Ficha completa de um personagem.");

        grupo.MapPost("/{cod:int}/atributos", async (
            int cod,
            DistribuirPontosRequest request,
            IPersonagemService personagens,
            IUsuarioAtual usuario,
            CancellationToken ct) =>
        {
            if (SessaoJogo.ExigirTripulacao(usuario) is { } problema)
            {
                return problema;
            }

            var resultado = await personagens.DistribuirPontosAsync(usuario.TripulacaoId!.Value, cod, request, ct);

            return resultado.ParaHttp();
        })
        .WithName("DistribuirPontos")
        .WithSummary("Investe pontos disponíveis num atributo.");

        grupo.MapPost("/{cod:int}/evoluir", async (
            int cod,
            IPersonagemService personagens,
            IUsuarioAtual usuario,
            CancellationToken ct) =>
        {
            if (SessaoJogo.ExigirTripulacao(usuario) is { } problema)
            {
                return problema;
            }

            var resultado = await personagens.EvoluirAsync(usuario.TripulacaoId!.Value, cod, ct);

            return resultado.ParaHttp();
        })
        .WithName("EvoluirPersonagem")
        .WithSummary("Sobe um nível consumindo o XP acumulado.");

        return app;
    }
}
