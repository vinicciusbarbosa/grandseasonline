namespace SugoiGame.Domain;

/// <summary>
/// Constantes de balanceamento que no legado viviam espalhadas entre
/// public/Includes/conectdb.php e os scripts que as usavam.
/// </summary>
public static class ConstantesJogo
{
    public const int NivelMaximo = 50;

    /// <summary>Pontos de atributo ganhos a cada nível (PONTOS_POR_NIVEL).</summary>
    public const int PontosPorNivel = 4;

    /// <summary>HP ganho por ponto investido em Vitalidade (HP_POR_VITALIDADE).</summary>
    public const int HpPorVitalidade = 50;

    /// <summary>MP ganho por ponto investido em Vitalidade.</summary>
    public const int MpPorVitalidade = 7;

    public const int HpPorNivel = 100;

    public const int MpPorNivel = 7;

    public const int FamaAmeacaPorNivel = 20_000;

    public const int ReputacaoPorEvolucao = 5;

    /// <summary>
    /// Teto de níveis somados da tripulação (50 × 15) acima do qual evoluir
    /// deixa de render reputação.
    /// </summary>
    public const int MaxNiveisParaReputacao = NivelMaximo * 15;

    /// <summary>XP necessário para sair de um nível — equivale a formulaExp() em Funcoes/geral.php.</summary>
    public static int XpParaProximoNivel(int nivel) => 500 * nivel;
}
