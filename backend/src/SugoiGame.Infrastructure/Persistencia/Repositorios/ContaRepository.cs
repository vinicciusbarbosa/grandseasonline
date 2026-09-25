using Microsoft.EntityFrameworkCore;
using SugoiGame.Application.Abstractions;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Infrastructure.Persistencia.Repositorios;

public class ContaRepository(SugoiDbContext db) : IContaRepository
{
    public Task<Conta?> ObterPorEmailAsync(string email, CancellationToken ct = default) =>
        db.Contas.FirstOrDefaultAsync(c => c.Email == email, ct);

    public Task<Conta?> ObterPorIdAsync(int contaId, CancellationToken ct = default) =>
        db.Contas.FirstOrDefaultAsync(c => c.Id == contaId, ct);

    public Task<Conta?> ObterPorIdEncriptadoAsync(string idEncriptado, CancellationToken ct = default) =>
        db.Contas.FirstOrDefaultAsync(c => c.IdEncriptado == idEncriptado, ct);

    public Task<bool> EmailJaCadastradoAsync(string email, CancellationToken ct = default) =>
        db.Contas.AnyAsync(c => c.Email == email, ct);

    public void Adicionar(Conta conta) => db.Contas.Add(conta);

    public void AdicionarAfilhado(Afilhado afilhado) => db.Afilhados.Add(afilhado);
}
