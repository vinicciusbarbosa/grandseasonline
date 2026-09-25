using Microsoft.Extensions.Options;
using SugoiGame.Application.Auth;
using SugoiGame.Application.Common;
using SugoiGame.Domain.Entities;
using SugoiGame.Infrastructure.Servicos;
using SugoiGame.Tests.Fakes;

namespace SugoiGame.Tests.Aplicacao;

public class AutenticacaoServiceTests
{
    private readonly BancoFake _banco = new();
    private readonly EnviadorEmailFake _email = new();
    private readonly HashSenhaBCrypt _hash = new();
    private readonly OpcoesJogo _opcoes = new();

    private AutenticacaoService CriarServico() => new(
        new ContaRepositoryFake(_banco),
        new TripulacaoRepositoryFake(_banco),
        new UnidadeDeTrabalhoFake(_banco),
        _hash,
        new GeradorToken(),
        _email,
        Options.Create(_opcoes));

    private Conta DadaUmaConta(string email = "pirata@sugoi.com", string senha = "segredo123")
    {
        var conta = new Conta
        {
            Id = _banco.ProximoId(),
            Nome = "Monkey D. Luffy",
            Email = email,
            SenhaHash = _hash.GerarHash(senha),
            IdEncriptado = new GeradorToken().GerarIdEncriptado(),
        };

        _banco.Contas.Add(conta);

        return conta;
    }

    [Fact]
    public async Task Login_com_credenciais_corretas_abre_a_sessao()
    {
        var conta = DadaUmaConta();
        var servico = CriarServico();

        var resultado = await servico.LoginAsync(new LoginRequest("pirata@sugoi.com", "segredo123"));

        Assert.True(resultado.Sucesso);
        Assert.Equal(conta.Id, resultado.Valor.ContaId);
        Assert.Equal("Monkey D. Luffy", resultado.Valor.Sessao.Conta.Nome);

        // O token devolvido é o mesmo persistido em tb_conta.cookie — é isso que o
        // PHP compara com o cookie sg_k.
        Assert.Equal(conta.TokenSessao, resultado.Valor.TokenSessao);
        Assert.Equal(32, resultado.Valor.TokenSessao.Length);
    }

    [Fact]
    public async Task Login_normaliza_o_email_informado()
    {
        DadaUmaConta("pirata@sugoi.com");
        var servico = CriarServico();

        var resultado = await servico.LoginAsync(new LoginRequest("  PIRATA@Sugoi.com  ", "segredo123"));

        Assert.True(resultado.Sucesso);
    }

    [Fact]
    public async Task Login_com_senha_errada_falha_sem_dizer_qual_campo_errou()
    {
        DadaUmaConta();
        var servico = CriarServico();

        var resultado = await servico.LoginAsync(new LoginRequest("pirata@sugoi.com", "errada"));

        Assert.True(resultado.Falhou);
        Assert.Equal("credenciais_invalidas", resultado.Erro!.Value.Codigo);
        Assert.Equal(TipoErro.NaoAutorizado, resultado.Erro!.Value.Tipo);
    }

    [Fact]
    public async Task Login_de_email_inexistente_devolve_o_mesmo_erro_de_senha_errada()
    {
        var servico = CriarServico();

        var resultado = await servico.LoginAsync(new LoginRequest("ninguem@sugoi.com", "qualquer"));

        Assert.True(resultado.Falhou);
        Assert.Equal("credenciais_invalidas", resultado.Erro!.Value.Codigo);
    }

    [Fact]
    public async Task Login_em_modo_beta_barra_conta_sem_acesso()
    {
        DadaUmaConta();
        _opcoes.ModoBeta = true;
        var servico = CriarServico();

        var resultado = await servico.LoginAsync(new LoginRequest("pirata@sugoi.com", "segredo123"));

        Assert.True(resultado.Falhou);
        Assert.Equal("fora_do_beta", resultado.Erro!.Value.Codigo);
    }

    [Fact]
    public async Task Login_em_modo_beta_permite_conta_marcada_como_beta()
    {
        var conta = DadaUmaConta();
        conta.Beta = true;
        _opcoes.ModoBeta = true;
        var servico = CriarServico();

        var resultado = await servico.LoginAsync(new LoginRequest("pirata@sugoi.com", "segredo123"));

        Assert.True(resultado.Sucesso);
    }

    [Fact]
    public async Task Cadastro_cria_a_conta_e_dispara_o_email_de_ativacao()
    {
        var servico = CriarServico();

        var resultado = await servico.RegistrarAsync(
            new RegistrarRequest("Roronoa Zoro", "zoro@sugoi.com", "tresespadas"));

        Assert.True(resultado.Sucesso);

        var conta = Assert.Single(_banco.Contas);
        Assert.Equal("zoro@sugoi.com", conta.Email);
        Assert.NotEqual("tresespadas", conta.SenhaHash);
        Assert.False(conta.EstaAtivada);

        var enviado = Assert.Single(_email.Enviados);
        Assert.Equal("zoro@sugoi.com", enviado.Email);
        Assert.Equal(conta.CodigoAtivacao, enviado.Codigo);
        Assert.Equal(8, enviado.Codigo.Length);
    }

    [Fact]
    public async Task Cadastro_recusa_email_ja_usado()
    {
        DadaUmaConta("zoro@sugoi.com");
        var servico = CriarServico();

        var resultado = await servico.RegistrarAsync(
            new RegistrarRequest("Roronoa Zoro", "zoro@sugoi.com", "tresespadas"));

        Assert.True(resultado.Falhou);
        Assert.Equal("email_em_uso", resultado.Erro!.Value.Codigo);
    }

    [Theory]
    [InlineData("Nami", "nami@sugoi.com", "senhaboa", "nome_curto")]
    [InlineData("Nami Navegadora", "nami@sugoi.com", "abc", "senha_curta")]
    [InlineData("Nami Navegadora", "sem-arroba", "senhaboa", "email_invalido")]
    public async Task Cadastro_valida_os_campos(string nome, string email, string senha, string codigoEsperado)
    {
        var servico = CriarServico();

        var resultado = await servico.RegistrarAsync(new RegistrarRequest(nome, email, senha));

        Assert.True(resultado.Falhou);
        Assert.Equal(codigoEsperado, resultado.Erro!.Value.Codigo);
        Assert.Empty(_banco.Contas);
    }

    [Fact]
    public async Task Cadastro_com_padrinho_valido_registra_a_indicacao()
    {
        var padrinho = DadaUmaConta("padrinho@sugoi.com");
        var servico = CriarServico();

        var resultado = await servico.RegistrarAsync(
            new RegistrarRequest("Roronoa Zoro", "zoro@sugoi.com", "tresespadas", padrinho.IdEncriptado));

        Assert.True(resultado.Sucesso);

        var indicacao = Assert.Single(_banco.Afilhados);
        Assert.Equal(padrinho.Id, indicacao.PadrinhoId);
    }

    [Fact]
    public async Task Cadastro_com_padrinho_desconhecido_segue_sem_registrar_indicacao()
    {
        var servico = CriarServico();

        var resultado = await servico.RegistrarAsync(new RegistrarRequest(
            "Roronoa Zoro",
            "zoro@sugoi.com",
            "tresespadas",
            Padrinho: "00000000000000000000000000000000"));

        Assert.True(resultado.Sucesso);
        Assert.Empty(_banco.Afilhados);
    }

    [Fact]
    public async Task ValidarSessao_aceita_o_token_vigente_e_recusa_o_antigo()
    {
        DadaUmaConta();
        var servico = CriarServico();

        var primeiro = await servico.LoginAsync(new LoginRequest("pirata@sugoi.com", "segredo123"));
        var segundo = await servico.LoginAsync(new LoginRequest("pirata@sugoi.com", "segredo123"));

        var contaId = segundo.Valor.ContaId;

        Assert.NotNull(await servico.ValidarSessaoAsync(contaId, segundo.Valor.TokenSessao));

        // Cada login rotaciona o token, então a sessão anterior morre.
        Assert.Null(await servico.ValidarSessaoAsync(contaId, primeiro.Valor.TokenSessao));
    }

    [Fact]
    public async Task Logout_invalida_a_sessao_tambem_para_o_php()
    {
        DadaUmaConta();
        var servico = CriarServico();

        var login = await servico.LoginAsync(new LoginRequest("pirata@sugoi.com", "segredo123"));
        await servico.LogoutAsync(login.Valor.ContaId);

        // O PHP autentica comparando com tb_conta.cookie; zerar a coluna derruba os dois.
        Assert.Null(_banco.Contas.Single().TokenSessao);
        Assert.Null(await servico.ValidarSessaoAsync(login.Valor.ContaId, login.Valor.TokenSessao));
    }

    [Fact]
    public async Task Sessao_traz_a_tripulacao_ativa_e_a_lista_completa()
    {
        var conta = DadaUmaConta();

        var primeira = new Tripulacao { Id = _banco.ProximoId(), ContaId = conta.Id, Nome = "Chapeus" };
        var segunda = new Tripulacao { Id = _banco.ProximoId(), ContaId = conta.Id, Nome = "Rumbar" };
        _banco.Tripulacoes.AddRange([primeira, segunda]);
        conta.TripulacaoAtivaId = segunda.Id;

        var servico = CriarServico();

        var resultado = await servico.ObterSessaoAsync(conta.Id);

        Assert.True(resultado.Sucesso);
        Assert.Equal(2, resultado.Valor.Tripulacoes.Count);
        Assert.Equal("Rumbar", resultado.Valor.TripulacaoAtiva!.Nome);
    }
}
