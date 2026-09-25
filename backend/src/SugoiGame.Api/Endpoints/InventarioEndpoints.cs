using SugoiGame.Api.Extensoes;
using SugoiGame.Application.Abstractions;
using SugoiGame.Application.Inventario;

namespace SugoiGame.Api.Endpoints;

public static class InventarioEndpoints
{
    public static IEndpointRouteBuilder MapInventarioEndpoints(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/inventario")
            .WithTags("Inventário")
            .RequireAuthorization();

        grupo.MapGet("/", async (
            IInventarioService inventario,
            IUsuarioAtual usuario,
            CancellationToken ct) =>
        {
            if (SessaoJogo.ExigirTripulacao(usuario) is { } problema)
            {
                return problema;
            }

            var resultado = await inventario.ObterAsync(usuario.TripulacaoId!.Value, ct);

            return resultado.ParaHttp();
        })
        .WithName("ObterInventario")
        .WithSummary("Itens no porão da tripulação, com a capacidade do navio.");

        grupo.MapPost("/{itemId:int}/descartar", async (
            int itemId,
            DescartarItemRequest request,
            IInventarioService inventario,
            IUsuarioAtual usuario,
            CancellationToken ct) =>
        {
            if (SessaoJogo.ExigirTripulacao(usuario) is { } problema)
            {
                return problema;
            }

            var resultado = await inventario.DescartarAsync(
                usuario.TripulacaoId!.Value, itemId, request.Quantidade, ct);

            return resultado.ParaHttp();
        })
        .WithName("DescartarItem")
        .WithSummary("Joga fora parte ou toda uma pilha do inventário.");

        return app;
    }
}

public record DescartarItemRequest(int Quantidade);
