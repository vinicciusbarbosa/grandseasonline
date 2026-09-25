namespace SugoiGame.Domain.Entities;

/// <summary>
/// Vínculo de indicação entre contas ("padrinho" e "afilhado").
/// Mapeia a tabela legada <c>tb_afilhados</c>, onde <c>id</c> é o padrinho.
/// </summary>
public class Afilhado
{
    /// <summary>Conta que indicou (padrinho).</summary>
    public int PadrinhoId { get; set; }

    /// <summary>Conta indicada. É a chave primária da tabela legada.</summary>
    public int AfilhadoId { get; set; }

    public bool BerriesGanhos { get; set; }

    public bool MedalhaGanha { get; set; }

    public bool BauGanho { get; set; }
}
