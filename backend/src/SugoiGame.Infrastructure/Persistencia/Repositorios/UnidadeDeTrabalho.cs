using Microsoft.EntityFrameworkCore;
using SugoiGame.Application.Abstractions;

namespace SugoiGame.Infrastructure.Persistencia.Repositorios;

public class UnidadeDeTrabalho(SugoiDbContext db) : IUnidadeDeTrabalho
{
    public Task<int> SalvarAsync(CancellationToken ct = default) => db.SaveChangesAsync(ct);

    /// <summary>
    /// Executa a ação numa transação. Se já houver uma transação aberta no
    /// contexto, apenas participa dela em vez de abrir outra.
    /// </summary>
    public async Task ExecutarEmTransacaoAsync(Func<CancellationToken, Task> acao, CancellationToken ct = default)
    {
        if (db.Database.CurrentTransaction is not null)
        {
            await acao(ct);
            return;
        }

        var estrategia = db.Database.CreateExecutionStrategy();

        await estrategia.ExecuteAsync(async () =>
        {
            await using var transacao = await db.Database.BeginTransactionAsync(ct);

            await acao(ct);

            await transacao.CommitAsync(ct);
        });
    }
}
