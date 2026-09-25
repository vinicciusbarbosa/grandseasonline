using SugoiGame.Domain.Enums;

namespace SugoiGame.Domain.Entities;

/// <summary>
/// Personagem de uma tripulação. Mapeia a tabela legada <c>tb_personagens</c>.
/// </summary>
/// <remarks>
/// Atenção ao schema legado: a chave primária é <c>cod</c> (auto increment) e
/// <c>id</c> é a FK para a tripulação — invertido em relação ao que o nome sugere.
/// <para>
/// Os valores iniciais das propriedades espelham os DEFAULT de
/// <c>tb_personagens</c>. O EF escreve toda coluna mapeada no INSERT, então sem
/// eles um personagem novo nasceria zerado em vez de usar o default do banco.
/// </para>
/// </remarks>
public class Personagem
{
    /// <summary>Chave primária (coluna <c>cod</c> no schema legado).</summary>
    public int Cod { get; set; }

    /// <summary>FK para a tripulação (coluna <c>id</c> no schema legado).</summary>
    public int TripulacaoId { get; set; }

    public string Nome { get; set; } = string.Empty;

    /// <summary>Índice do sprite do personagem (1..PERSONAGENS_MAX).</summary>
    public int Img { get; set; }

    public uint SkinCorpo { get; set; }

    public uint SkinRosto { get; set; }

    public int Lvl { get; set; } = 1;

    public int Xp { get; set; }

    public int XpMax { get; set; } = 150;

    public uint Hp { get; set; } = 5300;

    public uint HpMax { get; set; } = 5300;

    public uint Mp { get; set; } = 100;

    public uint MpMax { get; set; } = 100;

    public uint FamaAmeaca { get; set; }

    public int? TituloCod { get; set; }

    public int Classe { get; set; }

    public int Profissao { get; set; }

    public int ProfissaoLvl { get; set; }

    public double ProfissaoXp { get; set; }

    public double ProfissaoXpMax { get; set; }

    public int? AkumaCod { get; set; }

    // Atributos primários
    public int Atk { get; set; } = 1;
    public int Def { get; set; } = 1;
    public int Agl { get; set; } = 1;
    public int Res { get; set; } = 1;
    public int Pre { get; set; } = 1;
    public int Dex { get; set; } = 1;
    public int Con { get; set; } = 1;
    public int Vit { get; set; } = 1;

    /// <summary>Pontos de atributo ainda não distribuídos.</summary>
    public int Pts { get; set; } = 69;

    // Haki
    public int HakiLvl { get; set; } = 1;
    public int HakiXp { get; set; }
    public int HakiXpMax { get; set; } = 1000;
    public int HakiPts { get; set; } = 1;
    public int HakiEsquiva { get; set; }
    public int HakiBloqueio { get; set; }
    public int HakiCritico { get; set; }
    public uint HakiHdr { get; set; }

    /// <summary>Timestamp unix do fim do respawn. 0 quando o personagem está vivo.</summary>
    public double Respawn { get; set; }

    public bool Ativo { get; set; } = true;

    public uint Preso { get; set; }

    public int Sexo { get; set; }

    /// <summary>Acessório equipado. 0 significa nenhum (o legado não usa NULL aqui).</summary>
    public int CodAcessorio { get; set; }

    public Tripulacao Tripulacao { get; set; } = null!;

    public bool EstaVivo => Hp > 0;

    public bool PodeEvoluir => Xp >= XpMax && Lvl < ConstantesJogo.NivelMaximo;

    public int ObterAtributo(Atributo atributo) => atributo switch
    {
        Atributo.Atk => Atk,
        Atributo.Def => Def,
        Atributo.Agl => Agl,
        Atributo.Res => Res,
        Atributo.Pre => Pre,
        Atributo.Dex => Dex,
        Atributo.Con => Con,
        Atributo.Vit => Vit,
        _ => throw new ArgumentOutOfRangeException(nameof(atributo)),
    };

    /// <summary>
    /// Investe pontos disponíveis num atributo. Vitalidade também eleva HP e MP,
    /// como em Scripts/Personagem/adiciona_atributo.php.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// Quando não há pontos suficientes. O serviço valida antes de chegar aqui;
    /// esta guarda existe para a invariante não depender só do chamador.
    /// </exception>
    public void AplicarPontos(Atributo atributo, int quantidade)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(quantidade);

        if (quantidade > Pts)
        {
            throw new InvalidOperationException($"{Nome} tem {Pts} ponto(s) disponível(is), mas foram pedidos {quantidade}.");
        }

        switch (atributo)
        {
            case Atributo.Atk: Atk += quantidade; break;
            case Atributo.Def: Def += quantidade; break;
            case Atributo.Agl: Agl += quantidade; break;
            case Atributo.Res: Res += quantidade; break;
            case Atributo.Pre: Pre += quantidade; break;
            case Atributo.Dex: Dex += quantidade; break;
            case Atributo.Con: Con += quantidade; break;
            case Atributo.Vit:
                Vit += quantidade;
                var hpGanho = (uint)(ConstantesJogo.HpPorVitalidade * quantidade);
                var mpGanho = (uint)(ConstantesJogo.MpPorVitalidade * quantidade);
                HpMax += hpGanho;
                Hp += hpGanho;
                MpMax += mpGanho;
                Mp += mpGanho;
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(atributo));
        }

        Pts -= quantidade;
    }

    /// <summary>
    /// Sobe um nível, consumindo o XP acumulado. Portado de
    /// Scripts/Personagem/personagem_evoluir.php, inclusive a cura total:
    /// o UPDATE original fazia <c>hp = hp_max</c> depois de somar 100 ao máximo.
    /// </summary>
    public void Evoluir()
    {
        if (!PodeEvoluir)
        {
            throw new InvalidOperationException($"{Nome} não pode evoluir agora.");
        }

        Xp -= XpMax;
        Lvl++;
        XpMax = ConstantesJogo.XpParaProximoNivel(Lvl);
        Pts += ConstantesJogo.PontosPorNivel;

        HpMax += ConstantesJogo.HpPorNivel;
        Hp = HpMax;
        MpMax += ConstantesJogo.MpPorNivel;
        Mp = MpMax;

        FamaAmeaca += ConstantesJogo.FamaAmeacaPorNivel;
    }
}
