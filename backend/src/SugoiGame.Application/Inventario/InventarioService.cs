using SugoiGame.Application.Abstractions;
using SugoiGame.Application.Common;
using SugoiGame.Domain;

namespace SugoiGame.Application.Inventario;

/// <summary>
/// Inventário da tripulação. Portado de Scripts/Inventario/inventario.php e
/// Scripts/Inventario/descartar_item.php.
/// </summary>
public class InventarioService(
    IItemInventarioRepository itens,
    IDetalhesItemRepository detalhes,
    INavioRepository navios,
    IUnidadeDeTrabalho uow) : IInventarioService
{
    public async Task<Result<InventarioDto>> ObterAsync(int tripulacaoId, CancellationToken ct = default)
    {
        var inventario = await MontarAsync(tripulacaoId, ct);

        // Abrir o inventário limpa o destaque de "novo", como no legado.
        await itens.MarcarTodosComoVistosAsync(tripulacaoId, ct);

        return Result.Ok(inventario);
    }

    public async Task<Result<InventarioDto>> DescartarAsync(
        int tripulacaoId,
        int itemId,
        int quantidade,
        CancellationToken ct = default)
    {
        if (quantidade <= 0)
        {
            return Result.Falha<InventarioDto>(
                Erro.Validacao("quantidade_invalida", "Informe uma quantidade maior que zero."));
        }

        var item = await itens.ObterAsync(itemId, ct);

        // A checagem de dono é o que impede descartar o item de outra tripulação
        // passando um id qualquer.
        if (item is null || item.TripulacaoId != tripulacaoId)
        {
            return Result.Falha<InventarioDto>(
                Erro.NaoEncontrado("item_nao_encontrado", "Item não encontrado no seu inventário."));
        }

        if (quantidade > item.Quantidade)
        {
            return Result.Falha<InventarioDto>(Erro.Validacao(
                "quantidade_insuficiente",
                $"Você tem apenas {item.Quantidade} unidade(s) desse item."));
        }

        item.Quantidade -= quantidade;

        if (item.Quantidade == 0)
        {
            itens.Remover(item);
        }

        await uow.SalvarAsync(ct);

        return Result.Ok(await MontarAsync(tripulacaoId, ct));
    }

    private async Task<InventarioDto> MontarAsync(int tripulacaoId, CancellationToken ct)
    {
        var pilhas = await itens.ListarDaTripulacaoAsync(tripulacaoId, ct);

        // Uma consulta por tabela de detalhe, não uma por item: o legado fazia um
        // SELECT dentro do laço para comida, remédio e akuma.
        var chaves = pilhas
            .Select(p => (p.Tipo, Cod: p.CodItem))
            .Distinct()
            .ToList();

        var detalhesPorChave = await detalhes.ObterAsync(chaves, ct);

        var dtos = pilhas
            .Select(p => p.ParaDto(
                detalhesPorChave.GetValueOrDefault((p.Tipo, p.CodItem))
                ?? DetalheItem.Desconhecido(p.Tipo, p.CodItem)))
            .ToList();

        var navio = await navios.ObterDaTripulacaoAsync(tripulacaoId, ct);

        return new InventarioDto(
            dtos,
            Ocupado: pilhas.Count,
            Capacidade: navio?.CapacidadeInventario ?? 0,
            TemNavio: navio is not null);
    }
}
