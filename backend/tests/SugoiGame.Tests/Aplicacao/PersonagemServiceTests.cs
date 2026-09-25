using SugoiGame.Application.Common;
using SugoiGame.Application.Status;
using SugoiGame.Domain;
using SugoiGame.Domain.Entities;
using SugoiGame.Domain.Enums;
using SugoiGame.Tests.Fakes;

namespace SugoiGame.Tests.Aplicacao;

public class PersonagemServiceTests
{
    private const int MinhaTripulacao = 10;
    private const int OutraTripulacao = 20;

    private readonly BancoFake _banco = new();

    private PersonagemService CriarServico() => new(
        new PersonagemRepositoryFake(_banco),
        new TripulacaoRepositoryFake(_banco),
        new EquipamentoRepositoryFake(_banco),
        new UnidadeDeTrabalhoFake(_banco));

    private Personagem DadoUmPersonagem(int tripulacaoId, int cod, string nome, int pts = 10)
    {
        var personagem = new Personagem
        {
            Cod = cod,
            TripulacaoId = tripulacaoId,
            Nome = nome,
            Lvl = 1,
            Xp = 0,
            XpMax = 500,
            Hp = 5300,
            HpMax = 5300,
            Mp = 100,
            MpMax = 100,
            Pts = pts,
            Ativo = true,
        };

        _banco.Personagens.Add(personagem);

        if (_banco.Tripulacoes.All(t => t.Id != tripulacaoId))
        {
            _banco.Tripulacoes.Add(new Tripulacao
            {
                Id = tripulacaoId,
                ContaId = 1,
                Nome = $"Trip{tripulacaoId}",
                CapitaoCod = cod,
            });
        }

        return personagem;
    }

    [Fact]
    public async Task Obter_traz_a_ficha_com_os_oito_atributos_rotulados()
    {
        DadoUmPersonagem(MinhaTripulacao, cod: 1, "Luffy");
        var servico = CriarServico();

        var resultado = await servico.ObterAsync(MinhaTripulacao, cod: 1);

        Assert.True(resultado.Sucesso);
        Assert.Equal("Luffy", resultado.Valor.Nome);
        Assert.True(resultado.Valor.EhCapitao);
        Assert.Equal(8, resultado.Valor.Atributos.Count);
        Assert.Contains(resultado.Valor.Atributos, a => a.Atributo == Atributo.Con && a.Nome == "Percepção");
        Assert.All(resultado.Valor.Atributos, a => Assert.False(string.IsNullOrWhiteSpace(a.Descricao)));
    }

    /// <summary>
    /// O PHP filtrava por tripulação no SELECT de adiciona_atributo.php, mas
    /// personagem_evoluir.php confiava no cod recebido. Aqui a checagem é única
    /// e vale para todas as operações.
    /// </summary>
    [Fact]
    public async Task Operacoes_recusam_personagem_de_outra_tripulacao()
    {
        DadoUmPersonagem(OutraTripulacao, cod: 99, "Alheio");
        var servico = CriarServico();

        var leitura = await servico.ObterAsync(MinhaTripulacao, cod: 99);
        var pontos = await servico.DistribuirPontosAsync(
            MinhaTripulacao, cod: 99, new DistribuirPontosRequest(Atributo.Atk, 1));
        var evolucao = await servico.EvoluirAsync(MinhaTripulacao, cod: 99);

        foreach (var resultado in (Result<PersonagemStatusDto>[])[leitura, pontos, evolucao])
        {
            Assert.True(resultado.Falhou);
            Assert.Equal("personagem_nao_encontrado", resultado.Erro!.Value.Codigo);
        }

        Assert.Equal(1, _banco.Personagens.Single().Atk);
    }

    [Fact]
    public async Task DistribuirPontos_aplica_e_devolve_a_ficha_atualizada()
    {
        DadoUmPersonagem(MinhaTripulacao, cod: 1, "Luffy", pts: 10);
        var servico = CriarServico();

        var resultado = await servico.DistribuirPontosAsync(
            MinhaTripulacao, cod: 1, new DistribuirPontosRequest(Atributo.Vit, 4));

        Assert.True(resultado.Sucesso);
        Assert.Equal(6, resultado.Valor.PontosDisponiveis);
        Assert.Equal(5500u, resultado.Valor.HpMax);
        Assert.Equal(1, _banco.SalvamentosRealizados);
    }

    [Fact]
    public async Task DistribuirPontos_recusa_mais_do_que_o_disponivel_sem_salvar()
    {
        DadoUmPersonagem(MinhaTripulacao, cod: 1, "Luffy", pts: 2);
        var servico = CriarServico();

        var resultado = await servico.DistribuirPontosAsync(
            MinhaTripulacao, cod: 1, new DistribuirPontosRequest(Atributo.Atk, 3));

        Assert.True(resultado.Falhou);
        Assert.Equal("pontos_insuficientes", resultado.Erro!.Value.Codigo);
        Assert.Equal(0, _banco.SalvamentosRealizados);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task DistribuirPontos_recusa_quantidade_nao_positiva(int quantidade)
    {
        DadoUmPersonagem(MinhaTripulacao, cod: 1, "Luffy");
        var servico = CriarServico();

        var resultado = await servico.DistribuirPontosAsync(
            MinhaTripulacao, cod: 1, new DistribuirPontosRequest(Atributo.Atk, quantidade));

        Assert.True(resultado.Falhou);
        Assert.Equal("quantidade_invalida", resultado.Erro!.Value.Codigo);
    }

    [Fact]
    public async Task DistribuirPontos_recusa_atributo_fora_do_conjunto_conhecido()
    {
        DadoUmPersonagem(MinhaTripulacao, cod: 1, "Luffy");
        var servico = CriarServico();

        var resultado = await servico.DistribuirPontosAsync(
            MinhaTripulacao, cod: 1, new DistribuirPontosRequest((Atributo)42, 1));

        Assert.True(resultado.Falhou);
        Assert.Equal("atributo_invalido", resultado.Erro!.Value.Codigo);
    }

    [Fact]
    public async Task Evoluir_sobe_o_nivel_e_concede_reputacao_a_tripulacao()
    {
        var personagem = DadoUmPersonagem(MinhaTripulacao, cod: 1, "Luffy");
        personagem.Xp = 500;
        var servico = CriarServico();

        var resultado = await servico.EvoluirAsync(MinhaTripulacao, cod: 1);

        Assert.True(resultado.Sucesso);
        Assert.Equal(2, resultado.Valor.Lvl);

        var tripulacao = _banco.Tripulacoes.Single(t => t.Id == MinhaTripulacao);
        Assert.Equal(ConstantesJogo.ReputacaoPorEvolucao, tripulacao.Reputacao);
        Assert.Equal((uint)ConstantesJogo.ReputacaoPorEvolucao, tripulacao.ReputacaoMensal);
    }

    [Fact]
    public async Task Evoluir_nao_concede_reputacao_acima_do_teto_de_niveis()
    {
        var personagem = DadoUmPersonagem(MinhaTripulacao, cod: 1, "Luffy");
        personagem.Xp = 500;

        // Um segundo tripulante empurra a soma de níveis acima do teto de 750.
        var veterano = DadoUmPersonagem(MinhaTripulacao, cod: 2, "Zoro");
        veterano.Lvl = ConstantesJogo.MaxNiveisParaReputacao;

        var servico = CriarServico();

        var resultado = await servico.EvoluirAsync(MinhaTripulacao, cod: 1);

        Assert.True(resultado.Sucesso);
        Assert.Equal(0, _banco.Tripulacoes.Single(t => t.Id == MinhaTripulacao).Reputacao);
    }

    [Fact]
    public async Task Evoluir_recusa_sem_xp_suficiente()
    {
        DadoUmPersonagem(MinhaTripulacao, cod: 1, "Luffy");
        var servico = CriarServico();

        var resultado = await servico.EvoluirAsync(MinhaTripulacao, cod: 1);

        Assert.True(resultado.Falhou);
        Assert.Equal("xp_insuficiente", resultado.Erro!.Value.Codigo);
    }

    [Fact]
    public async Task Evoluir_recusa_no_nivel_maximo()
    {
        var personagem = DadoUmPersonagem(MinhaTripulacao, cod: 1, "Luffy");
        personagem.Lvl = ConstantesJogo.NivelMaximo;
        personagem.Xp = 999_999;
        var servico = CriarServico();

        var resultado = await servico.EvoluirAsync(MinhaTripulacao, cod: 1);

        Assert.True(resultado.Falhou);
        Assert.Equal("nivel_maximo", resultado.Erro!.Value.Codigo);
    }

    [Fact]
    public async Task Listar_traz_apenas_os_personagens_ativos_da_tripulacao()
    {
        DadoUmPersonagem(MinhaTripulacao, cod: 1, "Luffy");
        var inativo = DadoUmPersonagem(MinhaTripulacao, cod: 2, "Aposentado");
        inativo.Ativo = false;
        DadoUmPersonagem(OutraTripulacao, cod: 3, "Alheio");

        var servico = CriarServico();

        var resultado = await servico.ListarDaTripulacaoAsync(MinhaTripulacao);

        Assert.True(resultado.Sucesso);
        var unico = Assert.Single(resultado.Valor);
        Assert.Equal("Luffy", unico.Nome);
    }
}
