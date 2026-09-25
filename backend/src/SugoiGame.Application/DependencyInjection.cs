using Microsoft.Extensions.DependencyInjection;
using SugoiGame.Application.Auth;
using SugoiGame.Application.Equipamentos;
using SugoiGame.Application.Inventario;
using SugoiGame.Application.Status;
using SugoiGame.Application.Tripulacoes;

namespace SugoiGame.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IAutenticacaoService, AutenticacaoService>();
        services.AddScoped<ITripulacaoService, TripulacaoService>();
        services.AddScoped<IPersonagemService, PersonagemService>();
        services.AddScoped<IInventarioService, InventarioService>();
        services.AddScoped<IEquipamentoService, EquipamentoService>();

        return services;
    }
}
