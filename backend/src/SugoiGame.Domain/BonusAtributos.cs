using SugoiGame.Domain.Entities;
using SugoiGame.Domain.Enums;

namespace SugoiGame.Domain;

/// <summary>
/// Bônus somados aos atributos base de um personagem.
/// Portado de calc_bonus() em public/Funcoes/personagens.php.
/// </summary>
/// <remarks>
/// Estas são as três fontes já cobertas:
/// <list type="number">
/// <item>equipamentos vestidos, via <see cref="Equipamento.CalcularBonusPrimario"/>
/// e <see cref="Equipamento.CalcularBonusSecundario"/>;</item>
/// <item>o acessório do personagem, com bônus fixo em um atributo;</item>
/// <item>Haki de bloqueio, que soma o dobro do seu nível em Ataque.</item>
/// </list>
/// <para>
/// <b>Ainda fora</b>: os passivos de habilidade, que no legado vêm de
/// <c>Regras\Habilidades::get_todas_habilidades_pers()</c> e dependem de um
/// sistema de efeitos inteiro; e o modo "nivelamento", uma projeção usada só
/// para pré-visualizar o personagem no nível 50.
/// </para>
/// </remarks>
public sealed class BonusAtributos
{
    private readonly Dictionary<Atributo, decimal> _valores;

    private BonusAtributos(Dictionary<Atributo, decimal> valores) => _valores = valores;

    public decimal this[Atributo atributo] => _valores.GetValueOrDefault(atributo);

    public static BonusAtributos Vazio() => new(Novo());

    /// <summary>Verdadeiro quando nenhuma fonte concedeu bônus algum.</summary>
    public bool EstaVazio => _valores.Values.All(v => v == 0m);

    public IReadOnlyDictionary<Atributo, decimal> Valores => _valores;

    /// <param name="equipados">
    /// Equipamentos por slot vestido. Uma arma de duas mãos aparece nas duas
    /// mãos, mas só é contada uma vez.
    /// </param>
    public static BonusAtributos Calcular(
        Personagem personagem,
        IReadOnlyDictionary<SlotEquipamento, Equipamento> equipados,
        Acessorio? acessorio = null)
    {
        ArgumentNullException.ThrowIfNull(personagem);
        ArgumentNullException.ThrowIfNull(equipados);

        var bonus = Novo();

        foreach (var (slot, equipamento) in equipados)
        {
            // A arma de duas mãos ocupa a primeira e a segunda; contá-la nas duas
            // dobraria o bônus, que já vem dobrado pelo multiplicador de slot.
            if (slot == SlotEquipamento.SegundaMao && equipamento.Slot == SlotEquipamento.DuasMaos)
            {
                continue;
            }

            Somar(bonus, equipamento.BonusPrimarioAtributo, equipamento.CalcularBonusPrimario());
            Somar(bonus, equipamento.BonusSecundarioAtributo, equipamento.CalcularBonusSecundario());
        }

        if (acessorio is not null)
        {
            Somar(bonus, acessorio.BonusAtributo, acessorio.BonusQuantidade);
        }

        bonus[Atributo.Atk] += personagem.HakiBloqueio * 2;

        return new BonusAtributos(bonus);
    }

    private static void Somar(Dictionary<Atributo, decimal> bonus, int indiceAtributo, decimal valor)
    {
        // Índice 0 significa "sem bônus"; o PHP filtrava isso com empty().
        if (indiceAtributo == 0 || valor == 0m)
        {
            return;
        }

        if (!Enum.IsDefined(typeof(Atributo), indiceAtributo))
        {
            return;
        }

        bonus[(Atributo)indiceAtributo] += valor;
    }

    private static Dictionary<Atributo, decimal> Novo() =>
        Enum.GetValues<Atributo>().ToDictionary(a => a, _ => 0m);
}
