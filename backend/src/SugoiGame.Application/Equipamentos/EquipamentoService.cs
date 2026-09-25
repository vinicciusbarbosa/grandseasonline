using SugoiGame.Application.Abstractions;
using SugoiGame.Application.Common;
using SugoiGame.Application.Inventario;
using SugoiGame.Domain;
using SugoiGame.Domain.Entities;
using SugoiGame.Domain.Enums;

namespace SugoiGame.Application.Equipamentos;

/// <summary>
/// Vestir e retirar equipamentos. Portado de
/// Scripts/Personagem/equipamento_equipar.php e equipamento_desequipar.php.
/// </summary>
public class EquipamentoService(
    IPersonagemRepository personagens,
    IEquipamentoRepository equipamentos,
    IItemInventarioRepository itens,
    INavioRepository navios,
    IUnidadeDeTrabalho uow) : IEquipamentoService
{
    public async Task<Result<EquipamentosDoPersonagemDto>> ObterDoPersonagemAsync(
        int tripulacaoId,
        int personagemCod,
        CancellationToken ct = default)
    {
        var personagem = await CarregarPersonagemAsync(tripulacaoId, personagemCod, ct);
        if (personagem is null)
        {
            return NaoEncontrado();
        }

        return Result.Ok(await MontarAsync(personagemCod, ct));
    }

    public async Task<Result<EquipamentosDoPersonagemDto>> EquiparAsync(
        int tripulacaoId,
        int personagemCod,
        EquiparRequest request,
        CancellationToken ct = default)
    {
        var personagem = await CarregarPersonagemAsync(tripulacaoId, personagemCod, ct);
        if (personagem is null)
        {
            return NaoEncontrado();
        }

        // O legado procurava a peça só por cod_item e tipo_item, sem filtrar pela
        // tripulação: bastava saber o código para vestir o equipamento de outro
        // jogador. Aqui a posse é verificada.
        var noInventario = await itens.ObterPorItemAsync(
            tripulacaoId, TipoItem.Equipamento, request.CodEquipamento, ct);

        if (noInventario is null)
        {
            return Result.Falha<EquipamentosDoPersonagemDto>(
                Erro.NaoEncontrado("item_nao_encontrado", "Você não possui esse equipamento."));
        }

        var equipamento = await equipamentos.ObterAsync(request.CodEquipamento, ct);
        if (equipamento is null)
        {
            return Result.Falha<EquipamentosDoPersonagemDto>(
                Erro.NaoEncontrado("equipamento_nao_encontrado", "Equipamento não encontrado."));
        }

        if (personagem.Lvl < equipamento.Lvl)
        {
            return Result.Falha<EquipamentosDoPersonagemDto>(Erro.Validacao(
                "nivel_insuficiente",
                $"{personagem.Nome} precisa ser nível {equipamento.Lvl} para usar {equipamento.Nome}."));
        }

        if (equipamento.Requisito != 0 && equipamento.Requisito != personagem.Classe)
        {
            return Result.Falha<EquipamentosDoPersonagemDto>(Erro.Validacao(
                "classe_incompativel",
                $"{personagem.Nome} não tem a classe necessária para usar {equipamento.Nome}."));
        }

        var destinoOuErro = ResolverDestino(equipamento, request.SlotDestino);
        if (destinoOuErro.Falhou)
        {
            return Result.Falha<EquipamentosDoPersonagemDto>(destinoOuErro.Erro!.Value);
        }

        var destino = destinoOuErro.Valor;
        var equipados = await equipamentos.ObterOuCriarDoPersonagemAsync(personagemCod, ct);

        var deslocados = SlotsLiberados(equipados, equipamento, destino);

        // Cada peça deslocada volta como uma pilha nova no porão, então é preciso
        // haver espaço para todas elas.
        if (deslocados.Count > 0)
        {
            var erroCapacidade = await VerificarCapacidadeAsync(tripulacaoId, deslocados.Count, ct);
            if (erroCapacidade is not null)
            {
                return Result.Falha<EquipamentosDoPersonagemDto>(erroCapacidade.Value);
            }
        }

        await uow.ExecutarEmTransacaoAsync(async token =>
        {
            foreach (var cod in deslocados)
            {
                itens.Adicionar(new ItemInventario
                {
                    TripulacaoId = tripulacaoId,
                    Tipo = TipoItem.Equipamento,
                    CodItem = cod,
                    Quantidade = 1,
                    Novo = false,
                });
            }

            Vestir(equipados, equipamento, destino);

            itens.Remover(noInventario);

            await uow.SalvarAsync(token);
        }, ct);

        return Result.Ok(await MontarAsync(personagemCod, ct));
    }

    public async Task<Result<EquipamentosDoPersonagemDto>> DesequiparAsync(
        int tripulacaoId,
        int personagemCod,
        SlotEquipamento slot,
        CancellationToken ct = default)
    {
        if (!EquipamentosDoPersonagem.SlotsVestiveis.Contains(slot))
        {
            return Result.Falha<EquipamentosDoPersonagemDto>(
                Erro.Validacao("slot_invalido", "Esse slot não é uma posição do corpo."));
        }

        var personagem = await CarregarPersonagemAsync(tripulacaoId, personagemCod, ct);
        if (personagem is null)
        {
            return NaoEncontrado();
        }

        var equipados = await equipamentos.ObterOuCriarDoPersonagemAsync(personagemCod, ct);

        if (equipados.Obter(slot) is not { } cod)
        {
            return Result.Falha<EquipamentosDoPersonagemDto>(
                Erro.Validacao("slot_vazio", "Não há nada equipado nesse slot."));
        }

        var erroCapacidade = await VerificarCapacidadeAsync(tripulacaoId, 1, ct);
        if (erroCapacidade is not null)
        {
            return Result.Falha<EquipamentosDoPersonagemDto>(erroCapacidade.Value);
        }

        var equipamento = await equipamentos.ObterAsync(cod, ct);

        await uow.ExecutarEmTransacaoAsync(async token =>
        {
            // Uma arma de duas mãos está registrada nas duas: limpar só o slot
            // pedido deixaria a outra mão segurando uma peça que já voltou ao porão.
            if (equipamento?.Slot == SlotEquipamento.DuasMaos)
            {
                equipados.Definir(SlotEquipamento.PrimeiraMao, null);
                equipados.Definir(SlotEquipamento.SegundaMao, null);
            }
            else
            {
                equipados.Definir(slot, null);
            }

            itens.Adicionar(new ItemInventario
            {
                TripulacaoId = tripulacaoId,
                Tipo = TipoItem.Equipamento,
                CodItem = cod,
                Quantidade = 1,
                Novo = false,
            });

            await uow.SalvarAsync(token);
        }, ct);

        return Result.Ok(await MontarAsync(personagemCod, ct));
    }

    /// <summary>
    /// Decide em qual posição a peça vai. Só arma de uma mão aceita escolha; as
    /// demais têm destino fixo, e a de duas mãos sempre parte da primeira.
    /// </summary>
    private static Result<SlotEquipamento> ResolverDestino(Equipamento equipamento, SlotEquipamento? pedido)
    {
        var possiveis = SlotEquipamentoInfo.DestinosPossiveis(equipamento.Slot);

        if (possiveis.Count == 0)
        {
            return Result.Falha<SlotEquipamento>(
                Erro.Validacao("slot_invalido", "Esse equipamento não tem uma posição válida."));
        }

        if (pedido is null || possiveis.Count == 1)
        {
            return Result.Ok(possiveis[0]);
        }

        return possiveis.Contains(pedido.Value)
            ? Result.Ok(pedido.Value)
            : Result.Falha<SlotEquipamento>(Erro.Validacao(
                "slot_incompativel",
                $"{equipamento.Nome} não pode ser equipado em {SlotEquipamentoInfo.Nome(pedido.Value)}."));
    }

    /// <summary>
    /// Códigos que precisam voltar ao porão para abrir espaço, sem repetição —
    /// uma arma de duas mãos ocupa dois slots mas é uma peça só.
    /// </summary>
    private static List<int> SlotsLiberados(
        EquipamentosDoPersonagem equipados,
        Equipamento equipamento,
        SlotEquipamento destino)
    {
        var liberados = new List<int>();

        void Coletar(SlotEquipamento slot)
        {
            if (equipados.Obter(slot) is { } cod && !liberados.Contains(cod))
            {
                liberados.Add(cod);
            }
        }

        if (equipamento.Slot == SlotEquipamento.DuasMaos)
        {
            Coletar(SlotEquipamento.PrimeiraMao);
            Coletar(SlotEquipamento.SegundaMao);
        }
        else
        {
            Coletar(destino);

            // Trocar uma das mãos quando havia uma arma de duas mãos libera as duas.
            if (equipados.SeguraArmaDeDuasMaos &&
                destino is SlotEquipamento.PrimeiraMao or SlotEquipamento.SegundaMao)
            {
                Coletar(SlotEquipamento.PrimeiraMao);
                Coletar(SlotEquipamento.SegundaMao);
            }
        }

        return liberados;
    }

    private static void Vestir(
        EquipamentosDoPersonagem equipados,
        Equipamento equipamento,
        SlotEquipamento destino)
    {
        if (equipamento.Slot == SlotEquipamento.DuasMaos)
        {
            equipados.Definir(SlotEquipamento.PrimeiraMao, equipamento.Cod);
            equipados.Definir(SlotEquipamento.SegundaMao, equipamento.Cod);
            return;
        }

        // A arma de duas mãos que estava equipada some das duas mãos antes de a
        // nova peça entrar, senão a outra mão ficaria com um fantasma.
        if (equipados.SeguraArmaDeDuasMaos &&
            destino is SlotEquipamento.PrimeiraMao or SlotEquipamento.SegundaMao)
        {
            equipados.Definir(SlotEquipamento.PrimeiraMao, null);
            equipados.Definir(SlotEquipamento.SegundaMao, null);
        }

        equipados.Definir(destino, equipamento.Cod);
    }

    private async Task<Erro?> VerificarCapacidadeAsync(int tripulacaoId, int pilhasNecessarias, CancellationToken ct)
    {
        var navio = await navios.ObterDaTripulacaoAsync(tripulacaoId, ct);

        if (navio is null)
        {
            return Erro.Validacao(
                "sem_navio",
                "Sua tripulação ainda não tem um navio, então não há onde guardar equipamentos.");
        }

        var ocupado = await itens.ContarPilhasAsync(tripulacaoId, ct);

        return ocupado + pilhasNecessarias > navio.CapacidadeInventario
            ? Erro.Validacao("inventario_cheio", "A capacidade do inventário foi excedida.")
            : null;
    }

    private async Task<Personagem?> CarregarPersonagemAsync(int tripulacaoId, int cod, CancellationToken ct)
    {
        var personagem = await personagens.ObterPorCodAsync(cod, ct);

        return personagem?.TripulacaoId == tripulacaoId ? personagem : null;
    }

    private static Result<EquipamentosDoPersonagemDto> NaoEncontrado() =>
        Result.Falha<EquipamentosDoPersonagemDto>(
            Erro.NaoEncontrado("personagem_nao_encontrado", "Personagem não encontrado."));

    private async Task<EquipamentosDoPersonagemDto> MontarAsync(int personagemCod, CancellationToken ct)
    {
        var equipados = await equipamentos.ObterOuCriarDoPersonagemAsync(personagemCod, ct);

        var codigos = equipados.Ocupados().Select(o => o.Cod).Distinct().ToList();
        var porCod = (await equipamentos.ListarPorCodigosAsync(codigos, ct)).ToDictionary(e => e.Cod);

        var slots = EquipamentosDoPersonagem.SlotsVestiveis.Select(slot =>
        {
            var cod = equipados.Obter(slot);
            var equipamento = cod is not null ? porCod.GetValueOrDefault(cod.Value) : null;

            return new SlotEquipadoDto(
                slot,
                SlotEquipamentoInfo.Nome(slot),
                equipamento?.Nome,
                equipamento?.Descricao,
                equipamento?.Img ?? 0,
                equipamento?.ParaDto(),
                EspelhaArmaDeDuasMaos: slot == SlotEquipamento.SegundaMao
                    && equipamento?.Slot == SlotEquipamento.DuasMaos);
        }).ToList();

        return new EquipamentosDoPersonagemDto(personagemCod, slots);
    }
}
