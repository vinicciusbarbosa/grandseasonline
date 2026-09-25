using Microsoft.EntityFrameworkCore;
using SugoiGame.Application.Abstractions;
using SugoiGame.Domain.Entities;
using SugoiGame.Domain.Enums;

namespace SugoiGame.Infrastructure.Persistencia.Repositorios;

public class ItemInventarioRepository(SugoiDbContext db) : IItemInventarioRepository
{
    public Task<List<ItemInventario>> ListarDaTripulacaoAsync(int tripulacaoId, CancellationToken ct = default) =>
        db.ItensDeInventario
            .Where(i => i.TripulacaoId == tripulacaoId)
            .OrderBy(i => i.Tipo)
            .ThenBy(i => i.CodItem)
            .ToListAsync(ct);

    public Task<int> ContarPilhasAsync(int tripulacaoId, CancellationToken ct = default) =>
        db.ItensDeInventario.CountAsync(i => i.TripulacaoId == tripulacaoId, ct);

    public Task<ItemInventario?> ObterAsync(int id, CancellationToken ct = default) =>
        db.ItensDeInventario.FirstOrDefaultAsync(i => i.Id == id, ct);

    public Task<ItemInventario?> ObterPorItemAsync(
        int tripulacaoId,
        TipoItem tipo,
        int codItem,
        CancellationToken ct = default) =>
        db.ItensDeInventario.FirstOrDefaultAsync(
            i => i.TripulacaoId == tripulacaoId && i.Tipo == tipo && i.CodItem == codItem, ct);

    public void Adicionar(ItemInventario item) => db.ItensDeInventario.Add(item);

    public void Remover(ItemInventario item) => db.ItensDeInventario.Remove(item);

    /// <summary>
    /// Um UPDATE único em vez de carregar as pilhas para marcá-las uma a uma —
    /// nada aqui depende do estado anterior.
    /// </summary>
    public Task MarcarTodosComoVistosAsync(int tripulacaoId, CancellationToken ct = default) =>
        db.ItensDeInventario
            .Where(i => i.TripulacaoId == tripulacaoId && i.Novo)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.Novo, false), ct);
}
