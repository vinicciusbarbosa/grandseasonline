using Microsoft.EntityFrameworkCore;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Infrastructure.Persistencia;

/// <summary>
/// Contexto sobre o banco legado do Sugoi Game.
/// </summary>
/// <remarks>
/// Este é um mapeamento <i>database-first</i> sobre um schema que continua sendo
/// lido e escrito pelo PHP. Duas consequências valem lembrar:
/// <list type="bullet">
/// <item>Não existem migrations. O schema é de database/schema.sql e mudanças
/// nele precisam ser combinadas com o legado.</item>
/// <item>Só as colunas usadas pelas fatias já migradas estão mapeadas. As demais
/// continuam preenchidas por DEFAULT no INSERT e pelo PHP no UPDATE.</item>
/// </list>
/// </remarks>
public class SugoiDbContext(DbContextOptions<SugoiDbContext> options) : DbContext(options)
{
    public DbSet<Conta> Contas => Set<Conta>();

    public DbSet<Tripulacao> Tripulacoes => Set<Tripulacao>();

    public DbSet<Personagem> Personagens => Set<Personagem>();

    public DbSet<Vip> Vips => Set<Vip>();

    public DbSet<Afilhado> Afilhados => Set<Afilhado>();

    public DbSet<ItemInventario> ItensDeInventario => Set<ItemInventario>();

    public DbSet<Equipamento> Equipamentos => Set<Equipamento>();

    public DbSet<EquipamentosDoPersonagem> EquipamentosDosPersonagens => Set<EquipamentosDoPersonagem>();

    public DbSet<TreinoEquipamento> TreinosDeEquipamento => Set<TreinoEquipamento>();

    public DbSet<Acessorio> Acessorios => Set<Acessorio>();

    public DbSet<NavioDaTripulacao> Navios => Set<NavioDaTripulacao>();

    public DbSet<Reagente> Reagentes => Set<Reagente>();

    public DbSet<ItemDeMissao> ItensDeMissao => Set<ItemDeMissao>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SugoiDbContext).Assembly);

        base.OnModelCreating(modelBuilder);
    }
}
