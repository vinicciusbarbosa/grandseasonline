namespace SugoiGame.Application.Common;

/// <summary>
/// Regras globais do jogo que no PHP eram constantes em
/// public/Includes/conectdb.php e public/Constantes/*.php.
/// </summary>
public class OpcoesJogo
{
    public const string Secao = "Jogo";

    /// <summary>Equivalente à constante <c>IS_BETA</c>: só contas marcadas como beta conseguem entrar.</summary>
    public bool ModoBeta { get; set; }

    /// <summary>Máximo de tripulações por conta. No PHP era 3, fixo em criartrip.php.</summary>
    public int MaxTripulacoesPorConta { get; set; } = 3;

    /// <summary>
    /// Tamanho mínimo de senha. O PHP exigia 5; mantido por fidelidade, mas é o
    /// primeiro número que vale a pena subir quando o legado for aposentado.
    /// </summary>
    public int TamanhoMinimoSenha { get; set; } = 5;

    public int TamanhoMinimoNome { get; set; } = 5;

    /// <summary>Validade do cookie de sessão. O PHP usava 80000 segundos (~22h).</summary>
    public TimeSpan DuracaoSessao { get; set; } = TimeSpan.FromSeconds(80000);

    /// <summary>Pontos de partida de cada oceano inicial, replicando criartrip.php.</summary>
    public static readonly IReadOnlyDictionary<int, (int X, int Y)> OceanosIniciais = new Dictionary<int, (int, int)>
    {
        [1] = (428, 31),
        [2] = (70, 51),
        [3] = (424, 341),
        [4] = (35, 337),
    };
}
