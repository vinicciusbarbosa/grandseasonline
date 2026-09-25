using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.FileProviders;
using SugoiGame.Api.Autenticacao;
using SugoiGame.Api.Endpoints;
using SugoiGame.Application;
using SugoiGame.Application.Abstractions;
using SugoiGame.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

const string PoliticaCorsFront = "front";

builder.Services.Configure<OpcoesCookieSessao>(builder.Configuration.GetSection(OpcoesCookieSessao.Secao));

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddSingleton<SugoiGame.Infrastructure.Catalogos.IHostAmbiente, SugoiGame.Api.HostAmbiente>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IUsuarioAtual, UsuarioAtual>();
builder.Services.AddScoped<CookiesSessao>();

builder.Services
    .AddAuthentication(SessaoLegado.EsquemaAutenticacao)
    .AddScheme<AuthenticationSchemeOptions, SugoiCookieHandler>(SessaoLegado.EsquemaAutenticacao, _ => { });

builder.Services.AddAuthorization();

// Enums viajam como texto ("Pirata", "Vit") em vez de número: o contrato fica
// legível no front e não quebra se a ordem do enum mudar.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// Todo erro sai com um "codigo" estável em extensions, igual ao que o
// ResultadoHttp produz — assim o front tem sempre o mesmo contrato, inclusive
// nas falhas que nunca chegam à camada de aplicação.
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = contexto =>
    {
        contexto.ProblemDetails.Extensions.TryAdd(
            "codigo",
            contexto.ProblemDetails.Status == StatusCodes.Status400BadRequest
                ? "requisicao_invalida"
                : "erro_inesperado");
    };
});

builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
{
    var origens = builder.Configuration
        .GetSection($"{OpcoesCookieSessao.Secao}:OrigensPermitidas")
        .Get<string[]>() ?? ["http://localhost:5173"];

    options.AddPolicy(PoliticaCorsFront, policy => policy
        .WithOrigins(origens)
        .AllowAnyHeader()
        .AllowAnyMethod()

        // Obrigatório: a sessão viaja em cookie, não em header Authorization.
        .AllowCredentials());
});

var app = builder.Build();

// Um corpo JSON malformado (por exemplo um valor de enum que não existe) faz o
// binding lançar BadHttpRequestException, que já carrega o status 400. Sem o
// seletor abaixo o handler devolveria 500 e culparia o servidor por um erro do
// cliente.
app.UseExceptionHandler(new ExceptionHandlerOptions
{
    StatusCodeSelector = excecao => excecao is BadHttpRequestException requisicaoRuim
        ? requisicaoRuim.StatusCode
        : StatusCodes.Status500InternalServerError,
});

app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    // Em desenvolvimento o redirect atrapalha: o PHP legado responde em http e os
    // cookies de sessão precisam ser compartilhados no mesmo esquema.
    app.UseHttpsRedirection();
}

app.UseCors(PoliticaCorsFront);

ServirArteDoJogo(app);

app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapTripulacaoEndpoints();
app.MapPersonagemEndpoints();
app.MapInventarioEndpoints();
app.MapEquipamentoEndpoints();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).ExcludeFromDescription();

app.Run();

/// <summary>
/// Publica os sprites do jogo legado em /imagens.
/// </summary>
/// <remarks>
/// São ~24 mil arquivos em public/Imagens que o PHP serve direto do disco.
/// Copiá-los para o front seria duplicar centenas de megabytes, então a API os
/// serve do lugar onde já estão. É conteúdo público e imutável, daí o cache
/// longo.
/// </remarks>
static void ServirArteDoJogo(WebApplication app)
{
    var configurado = app.Configuration["Assets:PastaImagens"];

    var pasta = string.IsNullOrWhiteSpace(configurado)
        ? Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "..", "..", "public", "Imagens"))
        : Path.GetFullPath(configurado);

    if (!Directory.Exists(pasta))
    {
        app.Logger.LogWarning(
            "Arte do jogo não encontrada em {Pasta}; os sprites não serão servidos. "
            + "Ajuste Assets:PastaImagens se o legado estiver em outro lugar.",
            pasta);

        return;
    }

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(pasta),
        RequestPath = "/imagens",
        OnPrepareResponse = contexto =>
            contexto.Context.Response.Headers.CacheControl = "public,max-age=604800,immutable",
    });

    app.Logger.LogInformation("Arte do jogo publicada em /imagens a partir de {Pasta}", pasta);
}
