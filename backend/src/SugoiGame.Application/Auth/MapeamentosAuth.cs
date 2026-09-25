using SugoiGame.Domain.Entities;

namespace SugoiGame.Application.Auth;

internal static class MapeamentosAuth
{
    public static ContaDto ParaDto(this Conta conta) => new(
        conta.Id,
        conta.Nome,
        conta.Email,
        conta.IdEncriptado,
        conta.Gold,
        conta.Dobroes,
        conta.MedalhasRecrutamento,
        conta.EstaAtivada);

    public static CapitaoResumoDto ParaResumo(this Personagem personagem) => new(
        personagem.Cod,
        personagem.Nome,
        personagem.Img,
        personagem.Lvl,
        personagem.Xp,
        personagem.XpMax,
        personagem.Hp,
        personagem.HpMax,
        personagem.FamaAmeaca);

    public static TripulacaoResumoDto ParaResumo(this Tripulacao tripulacao) => new(
        tripulacao.Id,
        tripulacao.Nome,
        tripulacao.Faccao,
        tripulacao.Berries,
        tripulacao.Reputacao,
        tripulacao.X,
        tripulacao.Y,
        tripulacao.Capitao?.ParaResumo());
}
