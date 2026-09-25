namespace SugoiGame.Domain.Entities;

/// <summary>
/// Conta de usuário. Mapeia a tabela legada <c>tb_conta</c>.
/// Uma conta pode ter até 3 tripulações, mas apenas uma fica ativa por vez
/// (a apontada por <see cref="TripulacaoAtivaId"/>).
/// </summary>
public class Conta
{
    public int Id { get; set; }

    /// <summary>
    /// Hash público da conta, usado como código de indicação ("padrinho").
    /// No PHP é gerado como md5(time()).
    /// </summary>
    public string IdEncriptado { get; set; } = string.Empty;

    public int? TripulacaoAtivaId { get; set; }

    public string Email { get; set; } = string.Empty;

    /// <summary>Hash bcrypt gerado pelo password_hash() do PHP (prefixo $2y$).</summary>
    public string SenhaHash { get; set; } = string.Empty;

    public string Nome { get; set; } = string.Empty;

    public DateTime CriadoEm { get; set; }

    /// <summary>
    /// Token de sessão persistido. O PHP grava aqui o mesmo valor que envia
    /// no cookie <c>sg_k</c>; a autenticação compara os dois.
    /// </summary>
    public string? TokenSessao { get; set; }

    /// <summary>Código de ativação por e-mail. Nulo quando a conta já foi ativada.</summary>
    public string? CodigoAtivacao { get; set; }

    public uint Gold { get; set; }

    public string? FacebookId { get; set; }

    public uint Dobroes { get; set; }

    public uint DobroesCriados { get; set; }

    public uint MedalhasRecrutamento { get; set; }

    public bool Beta { get; set; }

    public Tripulacao? TripulacaoAtiva { get; set; }

    public ICollection<Tripulacao> Tripulacoes { get; set; } = [];

    public bool EstaAtivada => string.IsNullOrEmpty(CodigoAtivacao);
}
