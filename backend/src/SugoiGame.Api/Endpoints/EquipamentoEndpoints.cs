using SugoiGame.Api.Extensoes;
using SugoiGame.Application.Abstractions;
using SugoiGame.Application.Equipamentos;
using SugoiGame.Domain.Enums;

namespace SugoiGame.Api.Endpoints;

public static class EquipamentoEndpoints
{
    public static IEndpointRouteBuilder MapEquipamentoEndpoints(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/personagens/{cod:int}/equipamentos")
            .WithTags("Equipamentos")
            .RequireAuthorization();

        grupo.MapGet("/", async (
            int cod,
            IEquipamentoService equipamentos,
            IUsuarioAtual usuario,
            CancellationToken ct) =>
        {
            if (SessaoJogo.ExigirTripulacao(usuario) is { } problema)
            {
                return problema;
            }

            var resultado = await equipamentos.ObterDoPersonagemAsync(usuario.TripulacaoId!.Value, cod, ct);

            return resultado.ParaHttp();
        })
        .WithName("ObterEquipamentos")
        .WithSummary("Os 8 slots do personagem, ocupados ou vazios.");

        grupo.MapPost("/", async (
            int cod,
            EquiparRequest request,
            IEquipamentoService equipamentos,
            IUsuarioAtual usuario,
            CancellationToken ct) =>
        {
            if (SessaoJogo.ExigirTripulacao(usuario) is { } problema)
            {
                return problema;
            }

            var resultado = await equipamentos.EquiparAsync(usuario.TripulacaoId!.Value, cod, request, ct);

            return resultado.ParaHttp();
        })
        .WithName("EquiparItem")
        .WithSummary("Veste um equipamento do inventário; a peça deslocada volta ao porão.");

        grupo.MapDelete("/{slot}", async (
            int cod,
            SlotEquipamento slot,
            IEquipamentoService equipamentos,
            IUsuarioAtual usuario,
            CancellationToken ct) =>
        {
            if (SessaoJogo.ExigirTripulacao(usuario) is { } problema)
            {
                return problema;
            }

            var resultado = await equipamentos.DesequiparAsync(usuario.TripulacaoId!.Value, cod, slot, ct);

            return resultado.ParaHttp();
        })
        .WithName("DesequiparItem")
        .WithSummary("Retira a peça do slot e devolve ao inventário.");

        return app;
    }
}
