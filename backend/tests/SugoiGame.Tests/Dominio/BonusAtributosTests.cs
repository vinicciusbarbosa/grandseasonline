using SugoiGame.Domain;
using SugoiGame.Domain.Entities;
using SugoiGame.Domain.Enums;

namespace SugoiGame.Tests.Dominio;

/// <summary>
/// Fórmulas portadas de calc_bonus_equip_atr_principal/secundario e
/// cal_bonus_equip_atributo em public/Funcoes/equipamentos.php, e de
/// calc_bonus() em public/Funcoes/personagens.php.
/// </summary>
public class BonusAtributosTests
{
    private static Equipamento NovoEquipamento(
        int lvl = 20,
        int categoria = 5,
        int upgrade = 0,
        SlotEquipamento slot = SlotEquipamento.Colete,
        int b1 = (int)Atributo.Atk,
        int b2 = (int)Atributo.Def) => new()
    {
        Cod = 1,
        ItemBase = 100,
        Nome = "Colete de Teste",
        Lvl = lvl,
        Categoria = categoria,
        Upgrade = upgrade,
        Slot = slot,
        BonusPrimarioAtributo = b1,
        BonusSecundarioAtributo = b2,
    };

    private static Personagem NovoPersonagem(int hakiBloqueio = 0) => new()
    {
        Cod = 1,
        TripulacaoId = 1,
        Nome = "Luffy",
        HakiBloqueio = hakiBloqueio,
    };

    [Fact]
    public void Bonus_primario_divide_por_dez_menos_a_categoria()
    {
        var equipamento = NovoEquipamento(lvl: 20, categoria: 5);

        // (20 + 0) / (10 - 5) = 4
        Assert.Equal(4.00m, equipamento.CalcularBonusPrimario());
    }

    [Fact]
    public void Bonus_secundario_divide_por_onze_menos_a_categoria()
    {
        var equipamento = NovoEquipamento(lvl: 20, categoria: 5);

        // (20 + 0) / (11 - 5) = 3,333... arredondado para 2 casas
        Assert.Equal(3.33m, equipamento.CalcularBonusSecundario());
    }

    [Fact]
    public void Upgrade_soma_ao_nivel_antes_de_dividir()
    {
        var equipamento = NovoEquipamento(lvl: 30, categoria: 7, upgrade: 3);

        // (30 + 3) / (10 - 7) = 11
        Assert.Equal(11.00m, equipamento.CalcularBonusPrimario());
    }

    [Fact]
    public void Arma_de_duas_maos_rende_o_dobro()
    {
        var umaMao = NovoEquipamento(lvl: 30, categoria: 7, upgrade: 3, slot: SlotEquipamento.UmaMao);
        var duasMaos = NovoEquipamento(lvl: 30, categoria: 7, upgrade: 3, slot: SlotEquipamento.DuasMaos);

        Assert.Equal(11.00m, umaMao.CalcularBonusPrimario());
        Assert.Equal(22.00m, duasMaos.CalcularBonusPrimario());

        // (30 + 3) / (11 - 7) = 8,25 -> dobrado
        Assert.Equal(16.50m, duasMaos.CalcularBonusSecundario());
    }

    /// <summary>
    /// O round() do PHP joga o 0,5 para longe do zero. O padrão do .NET é
    /// arredondamento bancário, que devolveria 0,12 e faria o bônus divergir do
    /// legado em todo equipamento de nível baixo.
    /// </summary>
    [Fact]
    public void Arredondamento_segue_o_php_e_nao_o_bancario()
    {
        var equipamento = NovoEquipamento(lvl: 1, categoria: 2);

        // (1 + 0) / (10 - 2) = 0,125
        Assert.Equal(0.13m, equipamento.CalcularBonusPrimario());
    }

    [Theory]
    [InlineData(10)]
    [InlineData(12)]
    public void Categoria_que_zeraria_o_divisor_devolve_bonus_zero(int categoria)
    {
        // No PHP isso estouraria com DivisionByZeroError.
        var equipamento = NovoEquipamento(categoria: categoria);

        Assert.Equal(0m, equipamento.CalcularBonusPrimario());
    }

    [Fact]
    public void Calcular_soma_os_bonus_de_todos_os_slots_vestidos()
    {
        var capacete = NovoEquipamento(lvl: 20, categoria: 5, slot: SlotEquipamento.Cabeca,
            b1: (int)Atributo.Atk, b2: (int)Atributo.Def);
        var botas = NovoEquipamento(lvl: 10, categoria: 5, slot: SlotEquipamento.Botas,
            b1: (int)Atributo.Atk, b2: (int)Atributo.Agl);

        var bonus = BonusAtributos.Calcular(NovoPersonagem(), new Dictionary<SlotEquipamento, Equipamento>
        {
            [SlotEquipamento.Cabeca] = capacete,
            [SlotEquipamento.Botas] = botas,
        });

        // Atk recebe o primário dos dois: 20/5 + 10/5 = 4 + 2
        Assert.Equal(6.00m, bonus[Atributo.Atk]);
        Assert.Equal(3.33m, bonus[Atributo.Def]);
        Assert.Equal(1.67m, bonus[Atributo.Agl]);
        Assert.Equal(0m, bonus[Atributo.Vit]);
    }

    /// <summary>
    /// Uma arma de duas mãos aparece na primeira e na segunda mão. Contá-la duas
    /// vezes dobraria um bônus que o multiplicador de slot já dobrou.
    /// </summary>
    [Fact]
    public void Arma_de_duas_maos_equipada_e_contada_uma_vez_so()
    {
        var espada = NovoEquipamento(lvl: 20, categoria: 5, slot: SlotEquipamento.DuasMaos,
            b1: (int)Atributo.Atk, b2: 0);

        var bonus = BonusAtributos.Calcular(NovoPersonagem(), new Dictionary<SlotEquipamento, Equipamento>
        {
            [SlotEquipamento.PrimeiraMao] = espada,
            [SlotEquipamento.SegundaMao] = espada,
        });

        // 20/5 = 4, dobrado por ser de duas mãos = 8. E não 16.
        Assert.Equal(8.00m, bonus[Atributo.Atk]);
    }

    [Fact]
    public void Duas_armas_de_uma_mao_somam_normalmente()
    {
        var direita = NovoEquipamento(lvl: 20, categoria: 5, slot: SlotEquipamento.UmaMao,
            b1: (int)Atributo.Atk, b2: 0);
        var esquerda = NovoEquipamento(lvl: 20, categoria: 5, slot: SlotEquipamento.UmaMao,
            b1: (int)Atributo.Atk, b2: 0);

        var bonus = BonusAtributos.Calcular(NovoPersonagem(), new Dictionary<SlotEquipamento, Equipamento>
        {
            [SlotEquipamento.PrimeiraMao] = direita,
            [SlotEquipamento.SegundaMao] = esquerda,
        });

        Assert.Equal(8.00m, bonus[Atributo.Atk]);
    }

    [Fact]
    public void Atributo_zero_significa_sem_bonus()
    {
        var equipamento = NovoEquipamento(b1: 0, b2: 0);

        var bonus = BonusAtributos.Calcular(NovoPersonagem(), new Dictionary<SlotEquipamento, Equipamento>
        {
            [SlotEquipamento.Colete] = equipamento,
        });

        Assert.True(bonus.EstaVazio);
    }

    [Fact]
    public void Acessorio_soma_bonus_fixo_no_atributo_indicado()
    {
        var acessorio = new Acessorio
        {
            Cod = 7,
            Nome = "Bandana",
            BonusAtributo = (int)Atributo.Vit,
            BonusQuantidade = 15,
        };

        var bonus = BonusAtributos.Calcular(NovoPersonagem(), new Dictionary<SlotEquipamento, Equipamento>(), acessorio);

        Assert.Equal(15m, bonus[Atributo.Vit]);
    }

    [Fact]
    public void Haki_de_bloqueio_soma_o_dobro_em_ataque()
    {
        var bonus = BonusAtributos.Calcular(
            NovoPersonagem(hakiBloqueio: 12),
            new Dictionary<SlotEquipamento, Equipamento>());

        Assert.Equal(24m, bonus[Atributo.Atk]);
    }

    [Fact]
    public void Fontes_diferentes_se_acumulam_no_mesmo_atributo()
    {
        var equipamento = NovoEquipamento(lvl: 20, categoria: 5, b1: (int)Atributo.Atk, b2: 0);
        var acessorio = new Acessorio { Cod = 1, BonusAtributo = (int)Atributo.Atk, BonusQuantidade = 10 };

        var bonus = BonusAtributos.Calcular(
            NovoPersonagem(hakiBloqueio: 3),
            new Dictionary<SlotEquipamento, Equipamento> { [SlotEquipamento.Colete] = equipamento },
            acessorio);

        // equipamento 4 + acessório 10 + haki 3×2 = 20
        Assert.Equal(20m, bonus[Atributo.Atk]);
    }

    [Fact]
    public void Sem_nenhuma_fonte_o_bonus_fica_vazio()
    {
        var bonus = BonusAtributos.Calcular(NovoPersonagem(), new Dictionary<SlotEquipamento, Equipamento>());

        Assert.True(bonus.EstaVazio);
        Assert.Equal(8, bonus.Valores.Count);
    }
}
