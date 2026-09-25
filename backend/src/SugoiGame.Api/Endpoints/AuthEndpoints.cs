using SugoiGame.Api.Autenticacao;
using SugoiGame.Api.Extensoes;
using SugoiGame.Application.Abstractions;
using SugoiGame.Application.Auth;

namespace SugoiGame.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/auth").WithTags("Autenticação");

        grupo.MapPost("/login", async (
            LoginRequest request,
            IAutenticacaoService autenticacao,
            CookiesSessao cookies,
            HttpResponse response,
            CancellationToken ct) =>
        {
            var resultado = await autenticacao.LoginAsync(request, ct);
            if (resultado.Falhou)
            {
                return resultado.ParaHttp();
            }

            cookies.Gravar(response, resultado.Valor.ContaId, resultado.Valor.TokenSessao);

            return Results.Ok(resultado.Valor.Sessao);
        })
        .WithName("Login")
        .WithSummary("Autentica pelo e-mail e senha e abre a sessão compartilhada com o jogo legado.");

        grupo.MapPost("/cadastro", async (
            RegistrarRequest request,
            IAutenticacaoService autenticacao,
            CookiesSessao cookies,
            HttpResponse response,
            CancellationToken ct) =>
        {
            var resultado = await autenticacao.RegistrarAsync(request, ct);
            if (resultado.Falhou)
            {
                return resultado.ParaHttp();
            }

            cookies.Gravar(response, resultado.Valor.ContaId, resultado.Valor.TokenSessao);

            return Results.Created("/api/sessao", resultado.Valor.Sessao);
        })
        .WithName("Cadastrar")
        .WithSummary("Cria uma conta e já deixa o jogador logado.");

        grupo.MapPost("/logout", async (
            IAutenticacaoService autenticacao,
            IUsuarioAtual usuario,
            CookiesSessao cookies,
            HttpResponse response,
            CancellationToken ct) =>
        {
            if (usuario.ContaId is { } contaId)
            {
                await autenticacao.LogoutAsync(contaId, ct);
            }

            cookies.Limpar(response);

            return Results.NoContent();
        })
        .RequireAuthorization()
        .WithName("Logout")
        .WithSummary("Invalida a sessão na API e também no jogo legado.");

        app.MapGet("/api/sessao", async (
            IAutenticacaoService autenticacao,
            IUsuarioAtual usuario,
            CancellationToken ct) =>
        {
            var resultado = await autenticacao.ObterSessaoAsync(usuario.ContaId!.Value, ct);

            return resultado.ParaHttp();
        })
        .RequireAuthorization()
        .WithTags("Autenticação")
        .WithName("ObterSessao")
        .WithSummary("Estado da sessão atual: conta, tripulação ativa e tripulações disponíveis.");

        return app;
    }
}
