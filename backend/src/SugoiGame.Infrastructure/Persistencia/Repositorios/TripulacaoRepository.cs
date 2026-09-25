using Microsoft.EntityFrameworkCore;
using SugoiGame.Application.Abstractions;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Infrastructure.Persistencia.Repositorios;

public class TripulacaoRepository(SugoiDbContext db) : ITripulacaoRepository
{
    public Task<Tripulacao?> ObterPorIdAsync(int tripulacaoId, CancellationToken ct = default) =>
        db.Tripulacoes.FirstOrDefaultAsync(t => t.Id == tripulacaoId, ct);

    public Task<Tripulacao?> ObterCompletaAsync(int tripulacaoId, CancellationToken ct = default) =>
        db.Tripulacoes
            .Include(t => t.Capitao)
            .Include(t => t.Vip)
            .FirstOrDefaultAsync(t => t.Id == tripulacaoId, ct);

    public Task<List<Tripulacao>> ListarPorContaAsync(int contaId, CancellationToken ct = default) =>
        db.Tripulacoes
            .Include(t => t.Capitao)
            .Where(t => t.ContaId == contaId)
            .OrderBy(t => t.Id)
            .ToListAsync(ct);

    public Task<int> ContarPorContaAsync(int contaId, CancellationToken ct = default) =>
        db.Tripulacoes.CountAsync(t => t.ContaId == contaId, ct);

    public Task<bool> NomeJaUsadoAsync(string nome, CancellationToken ct = default) =>
        db.Tripulacoes.AnyAsync(t => t.Nome == nome, ct);

    public void Adicionar(Tripulacao tripulacao) => db.Tripulacoes.Add(tripulacao);
}
