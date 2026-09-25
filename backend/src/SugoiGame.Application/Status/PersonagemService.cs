using SugoiGame.Application.Abstractions;
using SugoiGame.Application.Common;
using SugoiGame.Domain;
using SugoiGame.Domain.Entities;
using SugoiGame.Domain.Enums;

namespace SugoiGame.Application.Status;

/// <summary>
/// Tela de status: ficha do personagem, distribuição de pontos e evolução.
/// Portado de Sessoes/status.php, Scripts/Personagem/adiciona_atributo.php e
/// Scripts/Personagem/personagem_evoluir.php.
/// </summary>
public class PersonagemService(
    IPersonagemRepository personagens,
    ITripulacaoRepository tripulacoes,
    IEquipamentoRepository equipamentos,
    IUnidadeDeTrabalho uow) : IPersonagemService
{
    public async Task<Result<IReadOnlyList<PersonagemStatusDto>>> ListarDaTripulacaoAsync(
        int tripulacaoId,
        CancellationToken ct = default)
    {
        var tripulacao = await tripulacoes.ObterPorIdAsync(tripulacaoId, ct);
        if (tripulacao is null)
        {
            return Result.Falha<IReadOnlyList<PersonagemStatusDto>>(
                Erro.NaoEncontrado("tripulacao_nao_encontrada", "Tripulação não encontrada."));
        }

        var lista = await personagens.ListarAtivosDaTripulacaoAsync(tripulacaoId, ct);
        var bonusPorPersonagem = await CalcularBonusAsync(lista, ct);

        IReadOnlyList<PersonagemStatusDto> dtos =
        [
            .. lista.Select(p => ParaDto(
                p,
                tripulacao.CapitaoCod,
                bonusPorPersonagem.GetValueOrDefault(p.Cod) ?? BonusAtributos.Vazio()))
        ];

        return Result.Ok(dtos);
    }

    public async Task<Result<PersonagemStatusDto>> ObterAsync(int tripulacaoId, int cod, CancellationToken ct = default)
    {
        var busca = await CarregarAsync(tripulacaoId, cod, ct);
        if (busca.Falhou)
        {
            return Result.Falha<PersonagemStatusDto>(busca.Erro!.Value);
        }

        return Result.Ok(await MontarDtoAsync(busca.Valor.Personagem, busca.Valor.CapitaoCod, ct));
    }

    public async Task<Result<PersonagemStatusDto>> DistribuirPontosAsync(
        int tripulacaoId,
        int cod,
        DistribuirPontosRequest request,
        CancellationToken ct = default)
    {
        if (!Enum.IsDefined(request.Atributo))
        {
            return Result.Falha<PersonagemStatusDto>(
                Erro.Validacao("atributo_invalido", "Atributo inválido."));
        }

        if (request.Quantidade <= 0)
        {
            return Result.Falha<PersonagemStatusDto>(
                Erro.Validacao("quantidade_invalida", "Informe uma quantidade maior que zero."));
        }

        var busca = await CarregarAsync(tripulacaoId, cod, ct);
        if (busca.Falhou)
        {
            return Result.Falha<PersonagemStatusDto>(busca.Erro!.Value);
        }

        var (personagem, capitaoCod) = busca.Valor;

        if (request.Quantidade > personagem.Pts)
        {
            return Result.Falha<PersonagemStatusDto>(Erro.Validacao(
                "pontos_insuficientes",
                $"{personagem.Nome} tem apenas {personagem.Pts} ponto(s) para distribuir."));
        }

        personagem.AplicarPontos(request.Atributo, request.Quantidade);
        await uow.SalvarAsync(ct);

        return Result.Ok(await MontarDtoAsync(personagem, capitaoCod, ct));
    }

    public async Task<Result<PersonagemStatusDto>> EvoluirAsync(int tripulacaoId, int cod, CancellationToken ct = default)
    {
        var busca = await CarregarAsync(tripulacaoId, cod, ct);
        if (busca.Falhou)
        {
            return Result.Falha<PersonagemStatusDto>(busca.Erro!.Value);
        }

        var (personagem, capitaoCod) = busca.Valor;

        if (personagem.Lvl >= ConstantesJogo.NivelMaximo)
        {
            return Result.Falha<PersonagemStatusDto>(
                Erro.Validacao("nivel_maximo", "Esse personagem já atingiu o nível máximo."));
        }

        if (personagem.Xp < personagem.XpMax)
        {
            return Result.Falha<PersonagemStatusDto>(
                Erro.Validacao("xp_insuficiente", "Esse personagem não tem experiência suficiente para evoluir."));
        }

        personagem.Evoluir();

        // Reputação só sobe enquanto a tripulação inteira estiver abaixo do teto de
        // níveis somados — evita farmar reputação com tripulantes descartáveis.
        var niveisDaTripulacao = await personagens.SomarNiveisDaTripulacaoAsync(tripulacaoId, ct);
        if (niveisDaTripulacao <= ConstantesJogo.MaxNiveisParaReputacao)
        {
            var tripulacao = await tripulacoes.ObterPorIdAsync(tripulacaoId, ct);
            if (tripulacao is not null)
            {
                tripulacao.Reputacao += ConstantesJogo.ReputacaoPorEvolucao;
                tripulacao.ReputacaoMensal += ConstantesJogo.ReputacaoPorEvolucao;
            }
        }

        await uow.SalvarAsync(ct);

        return Result.Ok(await MontarDtoAsync(personagem, capitaoCod, ct));
    }

    /// <summary>
    /// Carrega o personagem garantindo que ele pertence à tripulação da sessão.
    /// Sem essa checagem, trocar o <c>cod</c> na requisição daria acesso à ficha
    /// de qualquer personagem do jogo.
    /// </summary>
    private async Task<Result<(Personagem Personagem, int? CapitaoCod)>> CarregarAsync(
        int tripulacaoId,
        int cod,
        CancellationToken ct)
    {
        var naoEncontrado = Erro.NaoEncontrado("personagem_nao_encontrado", "Personagem não encontrado.");

        var personagem = await personagens.ObterPorCodAsync(cod, ct);
        if (personagem is null || personagem.TripulacaoId != tripulacaoId)
        {
            return Result.Falha<(Personagem, int?)>(naoEncontrado);
        }

        var tripulacao = await tripulacoes.ObterPorIdAsync(tripulacaoId, ct);

        return Result.Ok((personagem, tripulacao?.CapitaoCod));
    }

    private async Task<PersonagemStatusDto> MontarDtoAsync(Personagem personagem, int? capitaoCod, CancellationToken ct)
    {
        var bonus = await CalcularBonusAsync([personagem], ct);

        return ParaDto(personagem, capitaoCod, bonus.GetValueOrDefault(personagem.Cod) ?? BonusAtributos.Vazio());
    }

    /// <summary>
    /// Calcula o bônus de cada personagem em três consultas, independentemente do
    /// tamanho da tripulação: slots, equipamentos e acessórios em lote.
    /// </summary>
    private async Task<Dictionary<int, BonusAtributos>> CalcularBonusAsync(
        IReadOnlyCollection<Personagem> lista,
        CancellationToken ct)
    {
        if (lista.Count == 0)
        {
            return [];
        }

        var slotsPorPersonagem = await equipamentos.ObterDeVariosAsync([.. lista.Select(p => p.Cod)], ct);

        var codsEquipamento = slotsPorPersonagem.Values
            .SelectMany(s => s.Ocupados().Select(o => o.Cod))
            .Distinct()
            .ToList();

        var equipamentosPorCod = (await equipamentos.ListarPorCodigosAsync(codsEquipamento, ct))
            .ToDictionary(e => e.Cod);

        var codsAcessorio = lista.Where(p => p.CodAcessorio != 0).Select(p => p.CodAcessorio).Distinct().ToList();
        var acessoriosPorCod = await equipamentos.ListarAcessoriosAsync(codsAcessorio, ct);

        return lista.ToDictionary(
            personagem => personagem.Cod,
            personagem =>
            {
                var vestidos = new Dictionary<SlotEquipamento, Equipamento>();

                if (slotsPorPersonagem.TryGetValue(personagem.Cod, out var slots))
                {
                    foreach (var (slot, cod) in slots.Ocupados())
                    {
                        if (equipamentosPorCod.TryGetValue(cod, out var equipamento))
                        {
                            vestidos[slot] = equipamento;
                        }
                    }
                }

                var acessorio = personagem.CodAcessorio != 0
                    ? acessoriosPorCod.GetValueOrDefault(personagem.CodAcessorio)
                    : null;

                return BonusAtributos.Calcular(personagem, vestidos, acessorio);
            });
    }

    private static PersonagemStatusDto ParaDto(Personagem p, int? capitaoCod, BonusAtributos bonus) => new(
        p.Cod,
        p.Nome,
        p.Img,
        p.SkinCorpo,
        p.SkinRosto,
        p.Sexo,
        p.Lvl,
        p.Xp,
        p.XpMax,
        p.Hp,
        p.HpMax,
        p.Mp,
        p.MpMax,
        p.FamaAmeaca,
        p.TituloCod,
        p.Classe,
        p.AkumaCod,
        p.Ativo,
        EhCapitao: capitaoCod == p.Cod,
        p.PodeEvoluir,
        p.Pts,
        [.. AtributoInfo.Todos.Select(info => new AtributoDto(
            info.Atributo,
            info.Sigla,
            info.Nome,
            info.Descricao,
            p.ObterAtributo(info.Atributo),
            bonus[info.Atributo]))],
        new HakiDto(
            p.HakiLvl,
            p.HakiXp,
            p.HakiXpMax,
            p.HakiPts,
            p.HakiEsquiva,
            p.HakiBloqueio,
            p.HakiCritico,
            p.HakiHdr),
        new ProfissaoDto(
            p.Profissao,
            p.ProfissaoLvl,
            p.ProfissaoXp,
            p.ProfissaoXpMax));
}
