using Microsoft.Extensions.Options;
using SugoiGame.Application.Abstractions;
using SugoiGame.Application.Auth;
using SugoiGame.Application.Common;
using SugoiGame.Domain.Entities;
using SugoiGame.Domain.Enums;

namespace SugoiGame.Application.Tripulacoes;

/// <summary>
/// Criação e seleção de tripulações, portado de public/Scripts/Geral/criartrip.php
/// e public/Scripts/Geral/seltrip.php.
/// </summary>
public class TripulacaoService(
    IContaRepository contas,
    ITripulacaoRepository tripulacoes,
    IPersonagemRepository personagens,
    IUnidadeDeTrabalho uow,
    IAutenticacaoService autenticacao,
    IRelogio relogio,
    IOptions<OpcoesJogo> opcoes) : ITripulacaoService
{
    private readonly OpcoesJogo _opcoes = opcoes.Value;

    /// <summary>Bandeira padrão de tripulações novas, copiada do DEFAULT de <c>tb_usuarios</c>.</summary>
    private const string BandeiraPadrao = "010113046758010128123542010115204020";

    /// <summary>XP necessário para o nível 2, equivalente a formulaExp(1) em Funcoes/geral.php.</summary>
    private const int XpMaximoNivel1 = 500;

    public async Task<Result<IReadOnlyList<TripulacaoResumoDto>>> ListarAsync(int contaId, CancellationToken ct = default)
    {
        var sessao = await autenticacao.ObterSessaoAsync(contaId, ct);

        return sessao.Falhou
            ? Result.Falha<IReadOnlyList<TripulacaoResumoDto>>(sessao.Erro!.Value)
            : Result.Ok(sessao.Valor.Tripulacoes);
    }

    public async Task<Result<SessaoDto>> SelecionarAsync(int contaId, int tripulacaoId, CancellationToken ct = default)
    {
        var conta = await contas.ObterPorIdAsync(contaId, ct);
        if (conta is null)
        {
            return Result.Falha<SessaoDto>(Erro.NaoEncontrado("conta_nao_encontrada", "Conta não encontrada."));
        }

        var tripulacao = await tripulacoes.ObterPorIdAsync(tripulacaoId, ct);

        // A checagem de dono é o que impede um jogador de assumir a tripulação alheia
        // só trocando o id na requisição.
        if (tripulacao is null || tripulacao.ContaId != contaId)
        {
            return Result.Falha<SessaoDto>(
                Erro.NaoEncontrado("tripulacao_nao_encontrada", "Tripulação não encontrada nesta conta."));
        }

        conta.TripulacaoAtivaId = tripulacao.Id;
        tripulacao.UltimoLogon = relogio.TimestampUnix;

        await uow.SalvarAsync(ct);

        return await autenticacao.ObterSessaoAsync(contaId, ct);
    }

    public async Task<Result<SessaoDto>> CriarAsync(int contaId, CriarTripulacaoRequest request, CancellationToken ct = default)
    {
        var conta = await contas.ObterPorIdAsync(contaId, ct);
        if (conta is null)
        {
            return Result.Falha<SessaoDto>(Erro.NaoEncontrado("conta_nao_encontrada", "Conta não encontrada."));
        }

        var nomeTripulacao = request.NomeTripulacao?.Trim() ?? string.Empty;
        var nomeCapitao = request.NomeCapitao?.Trim() ?? string.Empty;

        if (Validar(nomeTripulacao, nomeCapitao, request.Faccao) is { } erroValidacao)
        {
            return Result.Falha<SessaoDto>(erroValidacao);
        }

        if (await tripulacoes.ContarPorContaAsync(contaId, ct) >= _opcoes.MaxTripulacoesPorConta)
        {
            return Result.Falha<SessaoDto>(Erro.Conflito(
                "limite_tripulacoes",
                $"O limite de tripulações por conta é de {_opcoes.MaxTripulacoesPorConta}."));
        }

        if (await tripulacoes.NomeJaUsadoAsync(nomeTripulacao, ct))
        {
            return Result.Falha<SessaoDto>(
                Erro.Conflito("nome_tripulacao_em_uso", "Esse nome de tripulação já está em uso."));
        }

        if (await personagens.NomeJaUsadoAsync(nomeCapitao, ct))
        {
            return Result.Falha<SessaoDto>(
                Erro.Conflito("nome_capitao_em_uso", "O nome de capitão informado já está cadastrado."));
        }

        var (x, y) = ResolverOceanoInicial(request.Oceano);

        await uow.ExecutarEmTransacaoAsync(async token =>
        {
            var tripulacao = new Tripulacao
            {
                ContaId = contaId,
                Nome = nomeTripulacao,
                Faccao = request.Faccao,
                X = x,
                Y = y,
                RespawnX = x,
                RespawnY = y,
                Bandeira = BandeiraPadrao,
                Vip = new Vip(),
            };

            tripulacoes.Adicionar(tripulacao);
            await uow.SalvarAsync(token);

            var capitao = new Personagem
            {
                TripulacaoId = tripulacao.Id,
                Nome = nomeCapitao,
                Img = request.IconeCapitao,
                XpMax = XpMaximoNivel1,
            };

            personagens.Adicionar(capitao);
            await uow.SalvarAsync(token);

            tripulacao.CapitaoCod = capitao.Cod;

            // Uma conta sem tripulação ativa cai na tela de seleção; ao criar a
            // primeira, já entramos direto nela.
            conta.TripulacaoAtivaId ??= tripulacao.Id;

            await uow.SalvarAsync(token);
        }, ct);

        return await autenticacao.ObterSessaoAsync(contaId, ct);
    }

    private static Erro? Validar(string nomeTripulacao, string nomeCapitao, Faccao faccao)
    {
        if (nomeTripulacao.Length is < 3 or > 15)
        {
            return Erro.Validacao("nome_tripulacao_invalido", "O nome da tripulação precisa ter de 3 a 15 caracteres.");
        }

        if (nomeCapitao.Length is < 3 or > 15)
        {
            return Erro.Validacao("nome_capitao_invalido", "O nome do capitão precisa ter de 3 a 15 caracteres.");
        }

        if (!NomeAceitavel(nomeTripulacao) || !NomeAceitavel(nomeCapitao))
        {
            return Erro.Validacao("nome_invalido", "Use apenas letras, números e espaços nos nomes.");
        }

        if (!Enum.IsDefined(faccao))
        {
            return Erro.Validacao("faccao_invalida", "Escolha entre Pirata e Marinha.");
        }

        return null;
    }

    /// <summary>Equivale ao post_alphanumeric_with_space_or_exit() do Protector do PHP.</summary>
    private static bool NomeAceitavel(string nome) => nome.All(c => char.IsLetterOrDigit(c) || c == ' ');

    private static (int X, int Y) ResolverOceanoInicial(int oceano) =>
        OpcoesJogo.OceanosIniciais.TryGetValue(oceano, out var coords)
            ? coords
            : OpcoesJogo.OceanosIniciais[Random.Shared.Next(1, OpcoesJogo.OceanosIniciais.Count + 1)];
}
