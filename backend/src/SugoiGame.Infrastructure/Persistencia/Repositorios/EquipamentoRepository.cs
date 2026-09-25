using Microsoft.EntityFrameworkCore;
using SugoiGame.Application.Abstractions;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Infrastructure.Persistencia.Repositorios;

public class EquipamentoRepository(SugoiDbContext db) : IEquipamentoRepository
{
    public Task<Equipamento?> ObterAsync(int cod, CancellationToken ct = default) =>
        db.Equipamentos.FirstOrDefaultAsync(e => e.Cod == cod, ct);

    public Task<List<Equipamento>> ListarPorCodigosAsync(
        IReadOnlyCollection<int> codigos,
        CancellationToken ct = default) =>
        codigos.Count == 0
            ? Task.FromResult(new List<Equipamento>())
            : db.Equipamentos.Where(e => codigos.Contains(e.Cod)).ToListAsync(ct);

    /// <summary>
    /// A linha de slots é criada sob demanda, como load_equipamentos() faz no
    /// legado: personagens antigos podem não ter registro em
    /// <c>tb_personagem_equipamentos</c>.
    /// </summary>
    public async Task<EquipamentosDoPersonagem> ObterOuCriarDoPersonagemAsync(
        int personagemCod,
        CancellationToken ct = default)
    {
        var existente = await db.EquipamentosDosPersonagens
            .FirstOrDefaultAsync(e => e.PersonagemCod == personagemCod, ct);

        if (existente is not null)
        {
            return existente;
        }

        var novo = new EquipamentosDoPersonagem { PersonagemCod = personagemCod };

        db.EquipamentosDosPersonagens.Add(novo);
        await db.SaveChangesAsync(ct);

        return novo;
    }

    public Task<Acessorio?> ObterAcessorioAsync(int cod, CancellationToken ct = default) =>
        db.Acessorios.FirstOrDefaultAsync(a => a.Cod == cod, ct);

    public async Task<IReadOnlyDictionary<int, EquipamentosDoPersonagem>> ObterDeVariosAsync(
        IReadOnlyCollection<int> personagemCods,
        CancellationToken ct = default)
    {
        if (personagemCods.Count == 0)
        {
            return new Dictionary<int, EquipamentosDoPersonagem>();
        }

        return await db.EquipamentosDosPersonagens
            .Where(e => personagemCods.Contains(e.PersonagemCod))
            .ToDictionaryAsync(e => e.PersonagemCod, ct);
    }

    public async Task<IReadOnlyDictionary<int, Acessorio>> ListarAcessoriosAsync(
        IReadOnlyCollection<int> codigos,
        CancellationToken ct = default)
    {
        if (codigos.Count == 0)
        {
            return new Dictionary<int, Acessorio>();
        }

        return await db.Acessorios
            .Where(a => codigos.Contains(a.Cod))
            .ToDictionaryAsync(a => a.Cod, ct);
    }
}

public class NavioRepository(SugoiDbContext db) : INavioRepository
{
    public Task<NavioDaTripulacao?> ObterDaTripulacaoAsync(int tripulacaoId, CancellationToken ct = default) =>
        db.Navios.FirstOrDefaultAsync(n => n.TripulacaoId == tripulacaoId, ct);
}
