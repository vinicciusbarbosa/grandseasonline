using SugoiGame.Domain;
using SugoiGame.Domain.Entities;
using SugoiGame.Domain.Enums;

namespace SugoiGame.Application.Abstractions;

public interface IItemInventarioRepository
{
    Task<List<ItemInventario>> ListarDaTripulacaoAsync(int tripulacaoId, CancellationToken ct = default);

    /// <summary>Quantas pilhas a tripulação ocupa — é isso que a capacidade limita.</summary>
    Task<int> ContarPilhasAsync(int tripulacaoId, CancellationToken ct = default);

    Task<ItemInventario?> ObterAsync(int id, CancellationToken ct = default);

    /// <summary>Busca uma pilha específica pelo par (tipo, código) dentro da tripulação.</summary>
    Task<ItemInventario?> ObterPorItemAsync(int tripulacaoId, TipoItem tipo, int codItem, CancellationToken ct = default);

    void Adicionar(ItemInventario item);

    void Remover(ItemInventario item);

    /// <summary>Tira a marca de "novo" de tudo, como o legado faz ao abrir o inventário.</summary>
    Task MarcarTodosComoVistosAsync(int tripulacaoId, CancellationToken ct = default);
}

/// <summary>
/// Resolve o lado apresentável dos itens, consultando a tabela de detalhe certa
/// para cada <see cref="TipoItem"/>.
/// </summary>
public interface IDetalhesItemRepository
{
    Task<IReadOnlyDictionary<(TipoItem Tipo, int Cod), DetalheItem>> ObterAsync(
        IReadOnlyCollection<(TipoItem Tipo, int Cod)> chaves,
        CancellationToken ct = default);
}

public interface IEquipamentoRepository
{
    Task<Equipamento?> ObterAsync(int cod, CancellationToken ct = default);

    Task<List<Equipamento>> ListarPorCodigosAsync(IReadOnlyCollection<int> codigos, CancellationToken ct = default);

    /// <summary>
    /// Traz os slots do personagem, criando a linha se ela ainda não existir —
    /// mesmo comportamento de load_equipamentos() no legado.
    /// </summary>
    Task<EquipamentosDoPersonagem> ObterOuCriarDoPersonagemAsync(int personagemCod, CancellationToken ct = default);

    Task<Acessorio?> ObterAcessorioAsync(int cod, CancellationToken ct = default);

    /// <summary>Slots de vários personagens de uma vez, para a tela da tripulação não cair em N+1.</summary>
    Task<IReadOnlyDictionary<int, EquipamentosDoPersonagem>> ObterDeVariosAsync(
        IReadOnlyCollection<int> personagemCods,
        CancellationToken ct = default);

    Task<IReadOnlyDictionary<int, Acessorio>> ListarAcessoriosAsync(
        IReadOnlyCollection<int> codigos,
        CancellationToken ct = default);
}

public interface INavioRepository
{
    Task<NavioDaTripulacao?> ObterDaTripulacaoAsync(int tripulacaoId, CancellationToken ct = default);
}
