using Microsoft.EntityFrameworkCore;
using SugoiGame.Application.Abstractions;
using SugoiGame.Domain;
using SugoiGame.Domain.Enums;
using SugoiGame.Infrastructure.Catalogos;

namespace SugoiGame.Infrastructure.Persistencia.Repositorios;

/// <summary>
/// Resolve o lado apresentável de cada item do inventário, consultando a tabela
/// de detalhe correspondente ao seu tipo.
/// </summary>
/// <remarks>
/// O legado fazia isso com um JOIN polimórfico montado em string
/// (<c>get_many_results_joined_mapped_by_type</c>) mais SELECTs dentro de laços.
/// Aqui é uma consulta por tipo presente no inventário, não por item.
/// <para>
/// Comida, remédio e akuma não têm tabela: vêm dos catálogos em public/Data,
/// carregados pelo <see cref="CatalogoDeDados"/>. As peças de navio (casco,
/// leme, velas, canhão, mapa, pose) têm tabela, mas vazia nos seeds — o item
/// aparece como desconhecido até existirem dados.
/// </para>
/// </remarks>
public class DetalhesItemRepository(SugoiDbContext db, CatalogoDeDados catalogo) : IDetalhesItemRepository
{
    public async Task<IReadOnlyDictionary<(TipoItem Tipo, int Cod), DetalheItem>> ObterAsync(
        IReadOnlyCollection<(TipoItem Tipo, int Cod)> chaves,
        CancellationToken ct = default)
    {
        var resultado = new Dictionary<(TipoItem, int), DetalheItem>();

        if (chaves.Count == 0)
        {
            return resultado;
        }

        foreach (var grupo in chaves.GroupBy(c => c.Tipo))
        {
            var codigos = grupo.Select(g => g.Cod).Distinct().ToList();

            // Itens que o legado descreve direto no código não têm tabela: o texto
            // é o mesmo para todos os códigos do tipo.
            if (DetalheItem.Embutido(grupo.Key) is { } embutido)
            {
                foreach (var cod in codigos)
                {
                    resultado[(grupo.Key, cod)] = embutido;
                }

                continue;
            }

            switch (grupo.Key)
            {
                case TipoItem.Equipamento:
                    foreach (var e in await db.Equipamentos.Where(x => codigos.Contains(x.Cod)).ToListAsync(ct))
                    {
                        resultado[(TipoItem.Equipamento, e.Cod)] =
                            new DetalheItem(e.Nome, e.Descricao, e.Img, "png", e);
                    }

                    break;

                case TipoItem.Acessorio:
                    foreach (var a in await db.Acessorios.Where(x => codigos.Contains(x.Cod)).ToListAsync(ct))
                    {
                        resultado[(TipoItem.Acessorio, a.Cod)] = new DetalheItem(a.Nome, a.Descricao, a.Img);
                    }

                    break;

                case TipoItem.Reagente:
                    foreach (var r in await db.Reagentes.Where(x => codigos.Contains(x.Cod)).ToListAsync(ct))
                    {
                        resultado[(TipoItem.Reagente, r.Cod)] =
                            new DetalheItem(r.Nome, r.Descricao, r.Img, r.ImgFormato ?? "png");
                    }

                    break;

                case TipoItem.Missao:
                    var longos = codigos.Select(c => (long)c).ToList();
                    foreach (var m in await db.ItensDeMissao.Where(x => longos.Contains(x.Id)).ToListAsync(ct))
                    {
                        resultado[(TipoItem.Missao, (int)m.Id)] = new DetalheItem(
                            m.Nome ?? "Item de missão",
                            m.Descricao ?? string.Empty,
                            m.Img ?? 0,
                            m.ImgFormato ?? "png");
                    }

                    break;

                case TipoItem.Comida:
                    Copiar(resultado, TipoItem.Comida, codigos, catalogo.Comidas);
                    break;

                case TipoItem.Remedio:
                    Copiar(resultado, TipoItem.Remedio, codigos, catalogo.Remedios);
                    break;

                case TipoItem.Akuma:
                    Copiar(resultado, TipoItem.Akuma, codigos, catalogo.Akumas);
                    break;

                default:
                    // Sem tabela nem catálogo: o serviço cai em DetalheItem.Desconhecido.
                    break;
            }
        }

        return resultado;
    }

    /// <summary>Copia do catálogo apenas os códigos que o inventário realmente tem.</summary>
    private static void Copiar(
        Dictionary<(TipoItem, int), DetalheItem> destino,
        TipoItem tipo,
        IEnumerable<int> codigos,
        IReadOnlyDictionary<int, DetalheItem> catalogo)
    {
        foreach (var cod in codigos)
        {
            if (catalogo.TryGetValue(cod, out var detalhe))
            {
                destino[(tipo, cod)] = detalhe;
            }
        }
    }
}
