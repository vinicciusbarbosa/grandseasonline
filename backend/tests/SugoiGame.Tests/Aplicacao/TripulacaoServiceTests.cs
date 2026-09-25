using Microsoft.Extensions.Options;
using SugoiGame.Application.Auth;
using SugoiGame.Application.Common;
using SugoiGame.Application.Tripulacoes;
using SugoiGame.Domain.Entities;
using SugoiGame.Domain.Enums;
using SugoiGame.Infrastructure.Servicos;
using SugoiGame.Tests.Fakes;

namespace SugoiGame.Tests.Aplicacao;

public class TripulacaoServiceTests
{
    private readonly BancoFake _banco = new();
    private readonly OpcoesJogo _opcoes = new();
    private readonly RelogioFake _relogio = new();

    private TripulacaoService CriarServico()
    {
        var contas = new ContaRepositoryFake(_banco);
        var tripulacoes = new TripulacaoRepositoryFake(_banco);
        var personagens = new PersonagemRepositoryFake(_banco);
        var uow = new UnidadeDeTrabalhoFake(_banco);

        var autenticacao = new AutenticacaoService(
            contas, tripulacoes, uow, new HashSenhaBCrypt(), new GeradorToken(),
            new EnviadorEmailFake(), Options.Create(_opcoes));

        return new TripulacaoService(contas, tripulacoes, personagens, uow, autenticacao, _relogio, Options.Create(_opcoes));
    }

    private Conta DadaUmaConta()
    {
        var conta = new Conta
        {
            Id = _banco.ProximoId(),
            Nome = "Jogador",
            Email = "jogador@sugoi.com",
            SenhaHash = "x",
            IdEncriptado = "abc",
        };

        _banco.Contas.Add(conta);

        return conta;
    }

    [Fact]
    public async Task Criar_monta_tripulacao_capitao_e_vip_e_ja_deixa_ela_ativa()
    {
        var conta = DadaUmaConta();
        var servico = CriarServico();

        var resultado = await servico.CriarAsync(conta.Id, new CriarTripulacaoRequest(
            NomeTripulacao: "Chapeus",
            NomeCapitao: "Luffy",
            Faccao: Faccao.Pirata,
            IconeCapitao: 12,
            Oceano: 2));

        Assert.True(resultado.Sucesso);

        var tripulacao = Assert.Single(_banco.Tripulacoes);
        Assert.Equal("Chapeus", tripulacao.Nome);
        Assert.Equal(Faccao.Pirata, tripulacao.Faccao);
        Assert.NotNull(tripulacao.Vip);

        // Oceano 2 começa em (70, 51), e o respawn nasce no mesmo ponto.
        Assert.Equal(70, tripulacao.X);
        Assert.Equal(51, tripulacao.Y);
        Assert.Equal(70, tripulacao.RespawnX);
        Assert.Equal(51, tripulacao.RespawnY);

        var capitao = Assert.Single(_banco.Personagens);
        Assert.Equal("Luffy", capitao.Nome);
        Assert.Equal(12, capitao.Img);
        Assert.Equal(500, capitao.XpMax);
        Assert.Equal(capitao.Cod, tripulacao.CapitaoCod);

        Assert.Equal(tripulacao.Id, conta.TripulacaoAtivaId);
        Assert.Equal(tripulacao.Id, resultado.Valor.TripulacaoAtiva!.Id);
    }

    [Fact]
    public async Task Criar_com_oceano_desconhecido_sorteia_um_ponto_valido()
    {
        var conta = DadaUmaConta();
        var servico = CriarServico();

        var resultado = await servico.CriarAsync(conta.Id, new CriarTripulacaoRequest(
            "Chapeus", "Luffy", Faccao.Pirata, 12, Oceano: 99));

        Assert.True(resultado.Sucesso);

        var tripulacao = Assert.Single(_banco.Tripulacoes);
        Assert.Contains((tripulacao.X, tripulacao.Y), OpcoesJogo.OceanosIniciais.Values);
    }

    [Fact]
    public async Task Criar_respeita_o_limite_de_tripulacoes_por_conta()
    {
        var conta = DadaUmaConta();
        _opcoes.MaxTripulacoesPorConta = 2;

        for (var i = 0; i < 2; i++)
        {
            _banco.Tripulacoes.Add(new Tripulacao { Id = _banco.ProximoId(), ContaId = conta.Id, Nome = $"Trip{i}" });
        }

        var servico = CriarServico();

        var resultado = await servico.CriarAsync(conta.Id, new CriarTripulacaoRequest(
            "Terceira", "Luffy", Faccao.Pirata, 12, 1));

        Assert.True(resultado.Falhou);
        Assert.Equal("limite_tripulacoes", resultado.Erro!.Value.Codigo);
    }

    [Fact]
    public async Task Criar_recusa_nome_de_capitao_ja_existente_no_jogo()
    {
        var conta = DadaUmaConta();
        _banco.Personagens.Add(new Personagem { Cod = 500, TripulacaoId = 999, Nome = "Luffy" });
        var servico = CriarServico();

        var resultado = await servico.CriarAsync(conta.Id, new CriarTripulacaoRequest(
            "Chapeus", "Luffy", Faccao.Pirata, 12, 1));

        Assert.True(resultado.Falhou);
        Assert.Equal("nome_capitao_em_uso", resultado.Erro!.Value.Codigo);
    }

    [Fact]
    public async Task Criar_recusa_nome_de_tripulacao_ja_existente()
    {
        var conta = DadaUmaConta();
        _banco.Tripulacoes.Add(new Tripulacao { Id = _banco.ProximoId(), ContaId = 999, Nome = "Chapeus" });
        var servico = CriarServico();

        var resultado = await servico.CriarAsync(conta.Id, new CriarTripulacaoRequest(
            "Chapeus", "Luffy", Faccao.Pirata, 12, 1));

        Assert.True(resultado.Falhou);
        Assert.Equal("nome_tripulacao_em_uso", resultado.Erro!.Value.Codigo);
    }

    [Theory]
    [InlineData("ab", "Luffy", "nome_tripulacao_invalido")]
    [InlineData("Chapeus", "Lu", "nome_capitao_invalido")]
    [InlineData("Chape<us>", "Luffy", "nome_invalido")]
    [InlineData("Chapeus", "Luffy!!", "nome_invalido")]
    public async Task Criar_valida_os_nomes(string tripulacao, string capitao, string codigoEsperado)
    {
        var conta = DadaUmaConta();
        var servico = CriarServico();

        var resultado = await servico.CriarAsync(conta.Id, new CriarTripulacaoRequest(
            tripulacao, capitao, Faccao.Pirata, 12, 1));

        Assert.True(resultado.Falhou);
        Assert.Equal(codigoEsperado, resultado.Erro!.Value.Codigo);
        Assert.Empty(_banco.Tripulacoes);
    }

    [Fact]
    public async Task Selecionar_troca_a_tripulacao_ativa_e_marca_o_logon()
    {
        var conta = DadaUmaConta();
        var primeira = new Tripulacao { Id = _banco.ProximoId(), ContaId = conta.Id, Nome = "Chapeus" };
        var segunda = new Tripulacao { Id = _banco.ProximoId(), ContaId = conta.Id, Nome = "Rumbar" };
        _banco.Tripulacoes.AddRange([primeira, segunda]);
        conta.TripulacaoAtivaId = primeira.Id;

        var servico = CriarServico();

        var resultado = await servico.SelecionarAsync(conta.Id, segunda.Id);

        Assert.True(resultado.Sucesso);
        Assert.Equal(segunda.Id, conta.TripulacaoAtivaId);
        Assert.Equal(_relogio.TimestampUnix, segunda.UltimoLogon);
    }

    /// <summary>
    /// Sem a checagem de dono, trocar o id na requisição daria acesso à
    /// tripulação de outro jogador.
    /// </summary>
    [Fact]
    public async Task Selecionar_recusa_tripulacao_de_outra_conta()
    {
        var conta = DadaUmaConta();
        var alheia = new Tripulacao { Id = _banco.ProximoId(), ContaId = 999, Nome = "Alheia" };
        _banco.Tripulacoes.Add(alheia);

        var servico = CriarServico();

        var resultado = await servico.SelecionarAsync(conta.Id, alheia.Id);

        Assert.True(resultado.Falhou);
        Assert.Equal("tripulacao_nao_encontrada", resultado.Erro!.Value.Codigo);
        Assert.Null(conta.TripulacaoAtivaId);
    }
}
