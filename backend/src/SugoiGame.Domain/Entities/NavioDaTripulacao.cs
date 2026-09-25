namespace SugoiGame.Domain.Entities;

/// <summary>
/// O navio da tripulação. Mapeia <c>tb_usuario_navio</c>.
/// </summary>
/// <remarks>
/// Mapeamento parcial de propósito: a fatia de inventário só precisa da
/// capacidade de carga. Casco, leme, velas, canhão, HP e reparo continuam com o
/// PHP até a fatia do estaleiro.
/// <para>
/// Sem navio não há inventário: no legado a capacidade cai para 0
/// (<c>verifica_login.php</c>), e com capacidade 0 nem desequipar funciona,
/// porque a peça retirada não teria onde ficar.
/// </para>
/// </remarks>
public class NavioDaTripulacao
{
    /// <summary>PK e FK para <c>tb_usuarios.id</c>.</summary>
    public int TripulacaoId { get; set; }

    public int? CodNavio { get; set; }

    /// <summary>Quantas <i>pilhas</i> de item cabem no porão.</summary>
    public int CapacidadeInventario { get; set; } = 55;

    public int Lvl { get; set; } = 1;

    public Tripulacao Tripulacao { get; set; } = null!;
}
