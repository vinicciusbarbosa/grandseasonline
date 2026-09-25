using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using SugoiGame.Application.Abstractions;
using SugoiGame.Application.Common;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Application.Auth;

/// <summary>
/// Porta do fluxo de autenticação para C#, preservando o contrato de sessão do
/// PHP: o token continua sendo gravado em <c>tb_conta.cookie</c> e comparado
/// com o cookie <c>sg_k</c>, de modo que uma sessão iniciada aqui vale no jogo
/// legado e vice-versa.
/// </summary>
public partial class AutenticacaoService(
    IContaRepository contas,
    ITripulacaoRepository tripulacoes,
    IUnidadeDeTrabalho uow,
    IHashSenha hashSenha,
    IGeradorToken geradorToken,
    IEnviadorEmail email,
    IOptions<OpcoesJogo> opcoes) : IAutenticacaoService
{
    private readonly OpcoesJogo _opcoes = opcoes.Value;

    public async Task<Result<ResultadoAutenticacao>> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var credenciaisInvalidas = Erro.NaoAutorizado("credenciais_invalidas", "E-mail e/ou senha inválidos.");

        var emailNormalizado = NormalizarEmail(request.Email);
        if (!EmailValido(emailNormalizado))
        {
            return Result.Falha<ResultadoAutenticacao>(credenciaisInvalidas);
        }

        var conta = await contas.ObterPorEmailAsync(emailNormalizado, ct);

        // Verifica o hash mesmo sem conta encontrada para não vazar, pelo tempo de
        // resposta, quais e-mails existem na base.
        var senhaConfere = hashSenha.Verificar(request.Senha, conta?.SenhaHash ?? HashDescartavel);

        if (conta is null || !senhaConfere)
        {
            return Result.Falha<ResultadoAutenticacao>(credenciaisInvalidas);
        }

        if (_opcoes.ModoBeta && !conta.Beta)
        {
            return Result.Falha<ResultadoAutenticacao>(
                Erro.NaoAutorizado("fora_do_beta", "O jogo está em beta fechado e sua conta não tem acesso."));
        }

        var token = await AbrirSessaoAsync(conta, ct);
        var sessao = await MontarSessaoAsync(conta, ct);

        return Result.Ok(new ResultadoAutenticacao(sessao, conta.Id, token));
    }

    public async Task<Result<ResultadoAutenticacao>> RegistrarAsync(RegistrarRequest request, CancellationToken ct = default)
    {
        var nome = request.Nome?.Trim() ?? string.Empty;
        var emailNormalizado = NormalizarEmail(request.Email);

        if (!EmailValido(emailNormalizado))
        {
            return Result.Falha<ResultadoAutenticacao>(
                Erro.Validacao("email_invalido", "Informe um e-mail válido."));
        }

        if (nome.Length < _opcoes.TamanhoMinimoNome)
        {
            return Result.Falha<ResultadoAutenticacao>(
                Erro.Validacao("nome_curto", $"O nome precisa de pelo menos {_opcoes.TamanhoMinimoNome} caracteres."));
        }

        if ((request.Senha?.Length ?? 0) < _opcoes.TamanhoMinimoSenha)
        {
            return Result.Falha<ResultadoAutenticacao>(
                Erro.Validacao("senha_curta", $"A senha precisa de pelo menos {_opcoes.TamanhoMinimoSenha} caracteres."));
        }

        if (await contas.EmailJaCadastradoAsync(emailNormalizado, ct))
        {
            return Result.Falha<ResultadoAutenticacao>(
                Erro.Conflito("email_em_uso", "O e-mail informado já está cadastrado."));
        }

        Conta? padrinho = null;
        if (!string.IsNullOrWhiteSpace(request.Padrinho))
        {
            if (!IdEncriptadoValido(request.Padrinho))
            {
                return Result.Falha<ResultadoAutenticacao>(
                    Erro.Validacao("padrinho_invalido", "O código de indicação informado é inválido."));
            }

            padrinho = await contas.ObterPorIdEncriptadoAsync(request.Padrinho, ct);
        }

        var codigoAtivacao = geradorToken.GerarCodigoAtivacao();
        var conta = new Conta
        {
            Nome = nome,
            Email = emailNormalizado,
            SenhaHash = hashSenha.GerarHash(request.Senha!),
            IdEncriptado = geradorToken.GerarIdEncriptado(),
            CodigoAtivacao = codigoAtivacao,
            TokenSessao = geradorToken.GerarTokenSessao(),
        };

        contas.Adicionar(conta);
        await uow.SalvarAsync(ct);

        if (padrinho is not null)
        {
            contas.AdicionarAfilhado(new Afilhado { PadrinhoId = padrinho.Id, AfilhadoId = conta.Id });
            await uow.SalvarAsync(ct);
        }

        // O envio do e-mail não pode derrubar o cadastro: no PHP, uma falha de SMTP
        // deixava a conta criada mas sem sessão, e o jogador ficava travado.
        await email.EnviarAtivacaoAsync(conta.Email, conta.Nome, conta.Id, codigoAtivacao, ct);

        var sessao = await MontarSessaoAsync(conta, ct);

        return Result.Ok(new ResultadoAutenticacao(sessao, conta.Id, conta.TokenSessao!));
    }

    public async Task<Result> LogoutAsync(int contaId, CancellationToken ct = default)
    {
        var conta = await contas.ObterPorIdAsync(contaId, ct);
        if (conta is null)
        {
            return Result.Ok();
        }

        conta.TokenSessao = null;
        await uow.SalvarAsync(ct);

        return Result.Ok();
    }

    public async Task<Conta?> ValidarSessaoAsync(int contaId, string token, CancellationToken ct = default)
    {
        if (contaId <= 0 || string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var conta = await contas.ObterPorIdAsync(contaId, ct);
        if (conta?.TokenSessao is null)
        {
            return null;
        }

        return TokensConferem(conta.TokenSessao, token) ? conta : null;
    }

    public async Task<Result<SessaoDto>> ObterSessaoAsync(int contaId, CancellationToken ct = default)
    {
        var conta = await contas.ObterPorIdAsync(contaId, ct);
        if (conta is null)
        {
            return Result.Falha<SessaoDto>(Erro.NaoEncontrado("conta_nao_encontrada", "Conta não encontrada."));
        }

        return Result.Ok(await MontarSessaoAsync(conta, ct));
    }

    private async Task<string> AbrirSessaoAsync(Conta conta, CancellationToken ct)
    {
        conta.TokenSessao = geradorToken.GerarTokenSessao();
        await uow.SalvarAsync(ct);

        return conta.TokenSessao;
    }

    private async Task<SessaoDto> MontarSessaoAsync(Conta conta, CancellationToken ct)
    {
        var lista = await tripulacoes.ListarPorContaAsync(conta.Id, ct);
        var resumos = lista.Select(t => t.ParaResumo()).ToList();

        var ativa = conta.TripulacaoAtivaId is { } ativaId
            ? resumos.FirstOrDefault(t => t.Id == ativaId)
            : null;

        return new SessaoDto(conta.ParaDto(), ativa, resumos);
    }

    /// <summary>
    /// Comparação em tempo constante — o token de sessão é um segredo, e o
    /// <c>==</c> usado pelo PHP original abria margem para ataque de temporização.
    /// </summary>
    private static bool TokensConferem(string esperado, string informado) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(esperado),
            Encoding.UTF8.GetBytes(informado));

    private static string NormalizarEmail(string? email) => email?.Trim().ToLowerInvariant() ?? string.Empty;

    private static bool EmailValido(string email) => email.Length <= 255 && RegexEmail().IsMatch(email);

    private static bool IdEncriptadoValido(string valor) => RegexHex32().IsMatch(valor);

    /// <summary>
    /// Hash bcrypt de uma senha aleatória, usado só para gastar o mesmo tempo de
    /// verificação quando o e-mail informado não existe na base.
    /// </summary>
    private const string HashDescartavel = "$2a$11$3nnEbHm1z3iZ2P0.mR2xIubZi/QqKM1LcmDXRVLxu1yFo6VJDGJqu";

    [GeneratedRegex(@"^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$", RegexOptions.IgnoreCase)]
    private static partial Regex RegexEmail();

    [GeneratedRegex("^[a-fA-F0-9]{32}$")]
    private static partial Regex RegexHex32();
}
