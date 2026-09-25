using SugoiGame.Domain;
using SugoiGame.Domain.Entities;
using SugoiGame.Domain.Enums;

namespace SugoiGame.Tests.Dominio;

/// <summary>
/// Regras portadas de Scripts/Personagem/adiciona_atributo.php e
/// Scripts/Personagem/personagem_evoluir.php.
/// </summary>
public class PersonagemTests
{
    private static Personagem NovoPersonagem() => new()
    {
        Cod = 1,
        TripulacaoId = 1,
        Nome = "Luffy",
        Lvl = 1,
        Xp = 0,
        XpMax = 500,
        Hp = 5300,
        HpMax = 5300,
        Mp = 100,
        MpMax = 100,
        Pts = 69,
        Ativo = true,
    };

    [Fact]
    public void AplicarPontos_em_atributo_comum_apenas_desconta_pontos()
    {
        var personagem = NovoPersonagem();

        personagem.AplicarPontos(Atributo.Atk, 5);

        Assert.Equal(6, personagem.Atk);
        Assert.Equal(64, personagem.Pts);
        Assert.Equal(5300u, personagem.HpMax);
        Assert.Equal(100u, personagem.MpMax);
    }

    [Fact]
    public void AplicarPontos_em_vitalidade_tambem_aumenta_hp_e_mp()
    {
        var personagem = NovoPersonagem();

        personagem.AplicarPontos(Atributo.Vit, 3);

        Assert.Equal(4, personagem.Vit);
        Assert.Equal(66, personagem.Pts);

        // 3 pontos × 50 de HP e × 7 de MP, somados tanto no atual quanto no máximo.
        Assert.Equal(5450u, personagem.HpMax);
        Assert.Equal(5450u, personagem.Hp);
        Assert.Equal(121u, personagem.MpMax);
        Assert.Equal(121u, personagem.Mp);
    }

    [Fact]
    public void AplicarPontos_recusa_mais_pontos_do_que_o_personagem_tem()
    {
        var personagem = NovoPersonagem();
        personagem.Pts = 2;

        Assert.Throws<InvalidOperationException>(() => personagem.AplicarPontos(Atributo.Def, 3));

        Assert.Equal(1, personagem.Def);
        Assert.Equal(2, personagem.Pts);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-4)]
    public void AplicarPontos_recusa_quantidade_nao_positiva(int quantidade)
    {
        var personagem = NovoPersonagem();

        Assert.Throws<ArgumentOutOfRangeException>(() => personagem.AplicarPontos(Atributo.Agl, quantidade));
    }

    [Fact]
    public void Evoluir_carrega_o_xp_excedente_para_o_proximo_nivel()
    {
        var personagem = NovoPersonagem();
        personagem.Xp = 620;

        personagem.Evoluir();

        Assert.Equal(2, personagem.Lvl);
        Assert.Equal(120, personagem.Xp);
        Assert.Equal(ConstantesJogo.XpParaProximoNivel(2), personagem.XpMax);
        Assert.Equal(1000, personagem.XpMax);
    }

    [Fact]
    public void Evoluir_concede_pontos_cura_por_completo_e_soma_fama()
    {
        var personagem = NovoPersonagem();
        personagem.Xp = 500;
        personagem.Hp = 1;
        personagem.Mp = 0;

        personagem.Evoluir();

        Assert.Equal(69 + ConstantesJogo.PontosPorNivel, personagem.Pts);

        // O UPDATE original fazia hp = hp_max depois de somar 100 ao máximo.
        Assert.Equal(5400u, personagem.HpMax);
        Assert.Equal(5400u, personagem.Hp);
        Assert.Equal(107u, personagem.MpMax);
        Assert.Equal(107u, personagem.Mp);

        Assert.Equal(20_000u, personagem.FamaAmeaca);
    }

    [Fact]
    public void Evoluir_recusa_personagem_sem_xp_suficiente()
    {
        var personagem = NovoPersonagem();
        personagem.Xp = 499;

        Assert.False(personagem.PodeEvoluir);
        Assert.Throws<InvalidOperationException>(personagem.Evoluir);
    }

    [Fact]
    public void Evoluir_recusa_personagem_no_nivel_maximo()
    {
        var personagem = NovoPersonagem();
        personagem.Lvl = ConstantesJogo.NivelMaximo;
        personagem.Xp = 999_999;

        Assert.False(personagem.PodeEvoluir);
        Assert.Throws<InvalidOperationException>(personagem.Evoluir);
    }

    [Fact]
    public void ObterAtributo_cobre_os_oito_atributos()
    {
        var personagem = NovoPersonagem();
        personagem.Atk = 10;
        personagem.Def = 20;
        personagem.Agl = 30;
        personagem.Res = 40;
        personagem.Pre = 50;
        personagem.Dex = 60;
        personagem.Con = 70;
        personagem.Vit = 80;

        Assert.Equal(10, personagem.ObterAtributo(Atributo.Atk));
        Assert.Equal(20, personagem.ObterAtributo(Atributo.Def));
        Assert.Equal(30, personagem.ObterAtributo(Atributo.Agl));
        Assert.Equal(40, personagem.ObterAtributo(Atributo.Res));
        Assert.Equal(50, personagem.ObterAtributo(Atributo.Pre));
        Assert.Equal(60, personagem.ObterAtributo(Atributo.Dex));
        Assert.Equal(70, personagem.ObterAtributo(Atributo.Con));
        Assert.Equal(80, personagem.ObterAtributo(Atributo.Vit));
    }
}
