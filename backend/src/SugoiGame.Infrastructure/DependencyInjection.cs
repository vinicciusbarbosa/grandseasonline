using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SugoiGame.Application.Abstractions;
using SugoiGame.Application.Common;
using SugoiGame.Infrastructure.Catalogos;
using SugoiGame.Infrastructure.Persistencia;
using SugoiGame.Infrastructure.Persistencia.Repositorios;
using SugoiGame.Infrastructure.Servicos;

namespace SugoiGame.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<OpcoesJogo>(configuration.GetSection(OpcoesJogo.Secao));

        var connectionString = configuration.GetConnectionString("Sugoi")
            ?? throw new InvalidOperationException(
                "Connection string 'Sugoi' não configurada. Defina em appsettings.json ou na variável de ambiente ConnectionStrings__Sugoi.");

        // A versão é declarada em vez de detectada para a API não depender do banco
        // estar de pé no momento da inicialização.
        var versaoServidor = new MySqlServerVersion(
            Version.Parse(configuration["Banco:VersaoMySql"] ?? "8.0.36"));

        services.AddDbContext<SugoiDbContext>(options =>
        {
            options.UseMySql(connectionString, versaoServidor, mysql => mysql.EnableRetryOnFailure());
        });

        services.AddScoped<IContaRepository, ContaRepository>();
        services.AddScoped<ITripulacaoRepository, TripulacaoRepository>();
        services.AddScoped<IPersonagemRepository, PersonagemRepository>();
        services.AddScoped<IItemInventarioRepository, ItemInventarioRepository>();
        services.AddScoped<IDetalhesItemRepository, DetalhesItemRepository>();
        services.AddScoped<IEquipamentoRepository, EquipamentoRepository>();
        services.AddScoped<INavioRepository, NavioRepository>();
        services.AddScoped<IUnidadeDeTrabalho, UnidadeDeTrabalho>();

        services.AddSingleton<CatalogoDeDados>();
        services.AddSingleton<IHashSenha, HashSenhaBCrypt>();
        services.AddSingleton<IGeradorToken, GeradorToken>();
        services.AddSingleton<IRelogio, RelogioSistema>();
        services.AddScoped<IEnviadorEmail, EnviadorEmailLog>();

        return services;
    }
}
