using SugoiGame.Application.Common;

namespace SugoiGame.Application.Inventario;

public interface IInventarioService
{
    /// <summary>
    /// Lista o inventário da tripulação. Assim como no legado, abrir o
    /// inventário também tira a marca de "novo" dos itens.
    /// </summary>
    Task<Result<InventarioDto>> ObterAsync(int tripulacaoId, CancellationToken ct = default);

    Task<Result<InventarioDto>> DescartarAsync(int tripulacaoId, int itemId, int quantidade, CancellationToken ct = default);
}
