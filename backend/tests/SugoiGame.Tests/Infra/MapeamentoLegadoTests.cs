using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using SugoiGame.Domain.Entities;
using SugoiGame.Infrastructure.Persistencia;

namespace SugoiGame.Tests.Infra;

/// <summary>
/// Verifica que o modelo aponta para as tabelas e colunas do schema legado
/// (database/schema.sql). Construir o modelo não abre conexão, então estes
/// testes rodam sem MySQL.
/// </summary>
public class MapeamentoLegadoTests
{
    private static SugoiDbContext CriarContexto()
    {
        var options = new DbContextOptionsBuilder<SugoiDbContext>()
            .UseMySql(
                "server=localhost;database=sugoi_v2;user=teste;password=teste",
                new MySqlServerVersion(new Version(8, 0, 36)))
            .Options;

        return new SugoiDbContext(options);
    }

    private static string ColunaDe<T>(SugoiDbContext db, string propriedade)
    {
        var entidade = db.Model.FindEntityType(typeof(T))
            ?? throw new InvalidOperationException($"{typeof(T).Name} não está no modelo.");

        var prop = entidade.FindProperty(propriedade)
            ?? throw new InvalidOperationException($"{typeof(T).Name}.{propriedade} não está mapeada.");

        return prop.GetColumnName();
    }

    [Fact]
    public void Modelo_e_construido_sem_erros()
    {
        using var db = CriarContexto();

        Assert.NotNull(db.Model);
    }

    [Theory]
    [InlineData(typeof(Conta), "tb_conta")]
    [InlineData(typeof(Tripulacao), "tb_usuarios")]
    [InlineData(typeof(Personagem), "tb_personagens")]
    [InlineData(typeof(Vip), "tb_vip")]
    [InlineData(typeof(Afilhado), "tb_afilhados")]
    public void Entidades_apontam_para_as_tabelas_legadas(Type tipo, string tabelaEsperada)
    {
        using var db = CriarContexto();

        var entidade = db.Model.FindEntityType(tipo);

        Assert.NotNull(entidade);
        Assert.Equal(tabelaEsperada, entidade.GetTableName());
    }

    [Theory]
    [InlineData(nameof(Conta.Id), "conta_id")]
    [InlineData(nameof(Conta.TripulacaoAtivaId), "tripulacao_id")]
    [InlineData(nameof(Conta.SenhaHash), "senha")]
    [InlineData(nameof(Conta.TokenSessao), "cookie")]
    [InlineData(nameof(Conta.IdEncriptado), "id_encrip")]
    [InlineData(nameof(Conta.CodigoAtivacao), "ativacao")]
    public void Conta_mapeia_as_colunas_renomeadas(string propriedade, string colunaEsperada)
    {
        using var db = CriarContexto();

        Assert.Equal(colunaEsperada, ColunaDe<Conta>(db, propriedade));
    }

    [Theory]
    [InlineData(nameof(Tripulacao.Nome), "tripulacao")]
    [InlineData(nameof(Tripulacao.CapitaoCod), "cod_personagem")]
    [InlineData(nameof(Tripulacao.RespawnX), "res_x")]
    [InlineData(nameof(Tripulacao.UltimoLogon), "ultimo_logon")]
    public void Tripulacao_mapeia_as_colunas_renomeadas(string propriedade, string colunaEsperada)
    {
        using var db = CriarContexto();

        Assert.Equal(colunaEsperada, ColunaDe<Tripulacao>(db, propriedade));
    }

    /// <summary>
    /// A inversão mais perigosa do schema legado: em <c>tb_personagens</c> a PK é
    /// <c>cod</c> e <c>id</c> é a FK da tripulação.
    /// </summary>
    [Fact]
    public void Personagem_respeita_a_inversao_de_cod_e_id()
    {
        using var db = CriarContexto();

        Assert.Equal("cod", ColunaDe<Personagem>(db, nameof(Personagem.Cod)));
        Assert.Equal("id", ColunaDe<Personagem>(db, nameof(Personagem.TripulacaoId)));

        var chave = db.Model.FindEntityType(typeof(Personagem))!.FindPrimaryKey();
        var propriedadeDaChave = Assert.Single(chave!.Properties);
        Assert.Equal(nameof(Personagem.Cod), propriedadeDaChave.Name);
    }

    [Theory]
    [InlineData(nameof(Personagem.HakiEsquiva), "haki_esq")]
    [InlineData(nameof(Personagem.HakiBloqueio), "haki_blo")]
    [InlineData(nameof(Personagem.HakiCritico), "haki_cri")]
    [InlineData(nameof(Personagem.SkinCorpo), "skin_c")]
    [InlineData(nameof(Personagem.SkinRosto), "skin_r")]
    [InlineData(nameof(Personagem.TituloCod), "titulo")]
    [InlineData(nameof(Personagem.AkumaCod), "akuma")]
    public void Personagem_mapeia_as_colunas_abreviadas(string propriedade, string colunaEsperada)
    {
        using var db = CriarContexto();

        Assert.Equal(colunaEsperada, ColunaDe<Personagem>(db, propriedade));
    }

    [Fact]
    public void Faccao_e_persistida_como_inteiro()
    {
        using var db = CriarContexto();

        var propriedade = db.Model.FindEntityType(typeof(Tripulacao))!.FindProperty(nameof(Tripulacao.Faccao))!;

        Assert.Equal(typeof(int), propriedade.GetProviderClrType());
    }

    [Fact]
    public void Chaves_que_sao_tambem_fk_nao_sao_geradas_pelo_banco()
    {
        using var db = CriarContexto();

        var vip = db.Model.FindEntityType(typeof(Vip))!.FindProperty(nameof(Vip.TripulacaoId))!;
        var afilhado = db.Model.FindEntityType(typeof(Afilhado))!.FindProperty(nameof(Afilhado.AfilhadoId))!;

        Assert.Equal(ValueGenerated.Never, vip.ValueGenerated);
        Assert.Equal(ValueGenerated.Never, afilhado.ValueGenerated);
    }
}

/// <summary>
/// Invariantes que valem para o schema legado inteiro, e não só para as colunas
/// que algum teste lembrou de listar.
/// </summary>
public class ConvencoesDoSchemaLegadoTests
{
    private static SugoiDbContext CriarContexto()
    {
        var options = new DbContextOptionsBuilder<SugoiDbContext>()
            .UseMySql(
                "server=localhost;database=sugoi_v2;user=teste;password=teste",
                new MySqlServerVersion(new Version(8, 0, 36)))
            .Options;

        return new SugoiDbContext(options);
    }

    /// <summary>
    /// O banco legado é todo minúsculo. Uma coluna com maiúscula só aparece
    /// quando alguém acrescentou uma propriedade e esqueceu o HasColumnName —
    /// aí o EF usa o nome do C# e a consulta quebra em runtime com
    /// "Unknown column". Este teste transforma isso em falha de build.
    /// </summary>
    [Fact]
    public void Nenhuma_coluna_mapeada_usa_o_nome_da_propriedade_csharp()
    {
        using var db = CriarContexto();

        var suspeitas = db.Model.GetEntityTypes()
            .SelectMany(e => e.GetProperties()
                .Select(p => (Entidade: e.ClrType.Name, Propriedade: p.Name, Coluna: p.GetColumnName())))
            .Where(x => x.Coluna.Any(char.IsUpper))
            .Select(x => $"{x.Entidade}.{x.Propriedade} -> {x.Coluna}")
            .ToList();

        Assert.Empty(suspeitas);
    }

    /// <summary>Toda tabela do legado começa com tb_, com a exceção histórica de "chat".</summary>
    [Fact]
    public void Todas_as_entidades_apontam_para_tabelas_do_legado()
    {
        using var db = CriarContexto();

        var foraDoPadrao = db.Model.GetEntityTypes()
            .Select(e => e.GetTableName())
            .Where(t => t is not null && !t.StartsWith("tb_") && t != "chat")
            .ToList();

        Assert.Empty(foraDoPadrao);
    }
}
