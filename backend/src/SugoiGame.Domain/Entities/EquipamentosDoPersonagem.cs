using SugoiGame.Domain.Enums;

namespace SugoiGame.Domain.Entities;

/// <summary>
/// Os 8 slots de equipamento de um personagem. Mapeia
/// <c>tb_personagem_equipamentos</c>, cujas colunas se chamam literalmente
/// "1" a "8".
/// </summary>
public class EquipamentosDoPersonagem
{
    /// <summary>PK e FK para <c>tb_personagens.cod</c>.</summary>
    public int PersonagemCod { get; set; }

    public int? Cabeca { get; set; }
    public int? Colete { get; set; }
    public int? Calcas { get; set; }
    public int? Botas { get; set; }
    public int? Luvas { get; set; }
    public int? Capa { get; set; }
    public int? PrimeiraMao { get; set; }
    public int? SegundaMao { get; set; }

    public Personagem Personagem { get; set; } = null!;

    /// <summary>Os slots vestíveis, de 1 a 8 — exclui UmaMao e DuasMaos, que são exigências de item.</summary>
    public static readonly IReadOnlyList<SlotEquipamento> SlotsVestiveis =
    [
        SlotEquipamento.Cabeca,
        SlotEquipamento.Colete,
        SlotEquipamento.Calcas,
        SlotEquipamento.Botas,
        SlotEquipamento.Luvas,
        SlotEquipamento.Capa,
        SlotEquipamento.PrimeiraMao,
        SlotEquipamento.SegundaMao,
    ];

    public int? Obter(SlotEquipamento slot) => slot switch
    {
        SlotEquipamento.Cabeca => Cabeca,
        SlotEquipamento.Colete => Colete,
        SlotEquipamento.Calcas => Calcas,
        SlotEquipamento.Botas => Botas,
        SlotEquipamento.Luvas => Luvas,
        SlotEquipamento.Capa => Capa,
        SlotEquipamento.PrimeiraMao => PrimeiraMao,
        SlotEquipamento.SegundaMao => SegundaMao,
        _ => throw new ArgumentOutOfRangeException(nameof(slot), slot, "Slot não é uma posição vestível."),
    };

    public void Definir(SlotEquipamento slot, int? codEquipamento)
    {
        switch (slot)
        {
            case SlotEquipamento.Cabeca: Cabeca = codEquipamento; break;
            case SlotEquipamento.Colete: Colete = codEquipamento; break;
            case SlotEquipamento.Calcas: Calcas = codEquipamento; break;
            case SlotEquipamento.Botas: Botas = codEquipamento; break;
            case SlotEquipamento.Luvas: Luvas = codEquipamento; break;
            case SlotEquipamento.Capa: Capa = codEquipamento; break;
            case SlotEquipamento.PrimeiraMao: PrimeiraMao = codEquipamento; break;
            case SlotEquipamento.SegundaMao: SegundaMao = codEquipamento; break;
            default:
                throw new ArgumentOutOfRangeException(nameof(slot), slot, "Slot não é uma posição vestível.");
        }
    }

    /// <summary>
    /// Verdadeiro quando as duas mãos seguram a mesma instância — a marca de uma
    /// arma de duas mãos equipada.
    /// </summary>
    public bool SeguraArmaDeDuasMaos => PrimeiraMao is not null && PrimeiraMao == SegundaMao;

    public IEnumerable<(SlotEquipamento Slot, int Cod)> Ocupados()
    {
        foreach (var slot in SlotsVestiveis)
        {
            if (Obter(slot) is { } cod)
            {
                yield return (slot, cod);
            }
        }
    }
}
