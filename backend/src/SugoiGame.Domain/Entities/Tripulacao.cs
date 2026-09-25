using SugoiGame.Domain.Enums;

namespace SugoiGame.Domain.Entities;

/// <summary>
/// Tripulação do jogador. Mapeia a tabela legada <c>tb_usuarios</c> — o nome
/// da tabela é enganoso: a conta é <c>tb_conta</c>, esta é a tripulação.
/// </summary>
/// <remarks>
/// A tabela original tem ~90 colunas cobrindo mapa, profissões, arena, coliseu,
/// eventos e campanhas. Aqui estão mapeadas apenas as que a fatia de
/// autenticação e status precisa; as demais continuam sendo escritas pelo PHP
/// e são preenchidas por DEFAULT no INSERT. Os valores iniciais das propriedades
/// mapeadas espelham os DEFAULT do schema pelo mesmo motivo descrito em
/// <see cref="Personagem"/>.
/// </remarks>
public class Tripulacao
{
    public int Id { get; set; }

    public int ContaId { get; set; }

    /// <summary>Nome da tripulação. Único no jogo inteiro, máximo 15 caracteres.</summary>
    public string Nome { get; set; } = string.Empty;

    public DateTime CriadaEm { get; set; }

    /// <summary>Último logon como timestamp unix em segundos (double no schema legado).</summary>
    public double? UltimoLogon { get; set; }

    public Faccao Faccao { get; set; }

    public int Reputacao { get; set; }

    public uint ReputacaoMensal { get; set; }

    public long Berries { get; set; } = 5000;

    /// <summary>Personagem capitão — o principal da tripulação.</summary>
    public int? CapitaoCod { get; set; }

    public int X { get; set; }

    public int Y { get; set; }

    public int RespawnX { get; set; }

    public int RespawnY { get; set; }

    public int Vitorias { get; set; }

    public int Derrotas { get; set; }

    public int Fugas { get; set; }

    public string Bandeira { get; set; } = string.Empty;

    public int Disposicao { get; set; } = 10_000;

    public uint KarmaBom { get; set; }

    public uint KarmaMau { get; set; }

    public uint BattlePoints { get; set; }

    public uint BattleLvl { get; set; } = 1;

    /// <summary>Nível de acesso administrativo. 0 = jogador comum.</summary>
    public int Adm { get; set; }

    public DateTime? Inativo { get; set; }

    public Conta Conta { get; set; } = null!;

    public Personagem? Capitao { get; set; }

    public ICollection<Personagem> Personagens { get; set; } = [];

    public Vip? Vip { get; set; }
}
