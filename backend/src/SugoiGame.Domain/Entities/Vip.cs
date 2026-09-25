namespace SugoiGame.Domain.Entities;

/// <summary>
/// Benefícios VIP ativos de uma tripulação. Mapeia a tabela legada <c>tb_vip</c>.
/// Cada benefício tem um contador de cargas e um timestamp unix de expiração.
/// </summary>
public class Vip
{
    /// <summary>PK e FK para a tripulação (coluna <c>id</c> no schema legado).</summary>
    public int TripulacaoId { get; set; }

    public int Luneta { get; set; }
    public double LunetaDuracao { get; set; }

    public int Sense { get; set; }
    public double SenseDuracao { get; set; }

    public int Tatic { get; set; }
    public double TaticDuracao { get; set; }

    public uint ResetPersonagem { get; set; }
    public uint ResetNome { get; set; }

    public int Conhecimento { get; set; }
    public double ConhecimentoDuracao { get; set; }

    public int CoupDeBurst { get; set; }
    public double CoupDeBurstDuracao { get; set; }

    public int Formacoes { get; set; }
    public double FormacoesDuracao { get; set; }

    public Tripulacao Tripulacao { get; set; } = null!;
}
