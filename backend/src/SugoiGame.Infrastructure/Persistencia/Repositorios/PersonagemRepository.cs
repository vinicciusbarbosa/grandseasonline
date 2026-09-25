using Microsoft.EntityFrameworkCore;
using SugoiGame.Application.Abstractions;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Infrastructure.Persistencia.Repositorios;

public class PersonagemRepository(SugoiDbContext db) : IPersonagemRepository
{
    public Task<Personagem?> ObterPorCodAsync(int cod, CancellationToken ct = default) =>
        db.Personagens.FirstOrDefaultAsync(p => p.Cod == cod, ct);

    public Task<List<Personagem>> ListarAtivosDaTripulacaoAsync(int tripulacaoId, CancellationToken ct = default) =>
        db.Personagens
            .Where(p => p.TripulacaoId == tripulacaoId && p.Ativo)
            .OrderBy(p => p.Cod)
            .ToListAsync(ct);

    public Task<bool> NomeJaUsadoAsync(string nome, CancellationToken ct = default) =>
        db.Personagens.AnyAsync(p => p.Nome == nome, ct);

    public Task<int> SomarNiveisDaTripulacaoAsync(int tripulacaoId, CancellationToken ct = default) =>
        db.Personagens
            .Where(p => p.TripulacaoId == tripulacaoId)
            .SumAsync(p => p.Lvl, ct);

    public void Adicionar(Personagem personagem) => db.Personagens.Add(personagem);
}
