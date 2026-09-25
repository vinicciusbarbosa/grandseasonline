using SugoiGame.Api.Extensoes;
using SugoiGame.Application.Abstractions;
using SugoiGame.Application.Tripulacoes;

namespace SugoiGame.Api.Endpoints;

public static class TripulacaoEndpoints
{
    public static IEndpointRouteBuilder MapTripulacaoEndpoints(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/tripulacoes")
            .WithTags("Tripulações")
            .RequireAuthorization();

        grupo.MapGet("/", async (
            ITripulacaoService tripulacoes,
            IUsuarioAtual usuario,
            CancellationToken ct) =>
        {
            var resultado = await tripulacoes.ListarAsync(usuario.ContaId!.Value, ct);

            return resultado.ParaHttp();
        })
        .WithName("ListarTripulacoes")
        .WithSummary("Tripulações da conta, para a tela de seleção.");

        grupo.MapPost("/", async (
            CriarTripulacaoRequest request,
            ITripulacaoService tripulacoes,
            IUsuarioAtual usuario,
            CancellationToken ct) =>
        {
            var resultado = await tripulacoes.CriarAsync(usuario.ContaId!.Value, request, ct);

            return resultado.ParaHttp();
        })
        .WithName("CriarTripulacao")
        .WithSummary("Cria uma tripulação com seu capitão e ponto de partida.");

        grupo.MapPost("/{id:int}/selecionar", async (
            int id,
            ITripulacaoService tripulacoes,
            IUsuarioAtual usuario,
            CancellationToken ct) =>
        {
            var resultado = await tripulacoes.SelecionarAsync(usuario.ContaId!.Value, id, ct);

            return resultado.ParaHttp();
        })
        .WithName("SelecionarTripulacao")
        .WithSummary("Torna esta a tripulação ativa da conta.");

        return app;
    }
}
