using SugoiGame.Domain.Enums;

namespace SugoiGame.Application.Auth;

public record LoginRequest(string Email, string Senha);

public record RegistrarRequest(string Nome, string Email, string Senha, string? Padrinho = null);

/// <summary>Conta do jogador, do jeito que o front precisa ver.</summary>
public record ContaDto(
    int Id,
    string Nome,
    string Email,
    string IdEncriptado,
    uint Gold,
    uint Dobroes,
    uint MedalhasRecrutamento,
    bool Ativada);

/// <summary>Resumo do capitão exibido no cabeçalho e na seleção de tripulação.</summary>
public record CapitaoResumoDto(
    int Cod,
    string Nome,
    int Img,
    int Lvl,
    int Xp,
    int XpMax,
    uint Hp,
    uint HpMax,
    uint FamaAmeaca);

public record TripulacaoResumoDto(
    int Id,
    string Nome,
    Faccao Faccao,
    long Berries,
    int Reputacao,
    int X,
    int Y,
    CapitaoResumoDto? Capitao);

/// <summary>Estado de sessão devolvido no boot do front e após o login.</summary>
public record SessaoDto(
    ContaDto Conta,
    TripulacaoResumoDto? TripulacaoAtiva,
    IReadOnlyList<TripulacaoResumoDto> Tripulacoes);

/// <summary>
/// Resultado de login/cadastro. O <see cref="TokenSessao"/> é devolvido para a
/// camada de API gravar os cookies <c>sg_c</c>/<c>sg_k</c> no mesmo formato do
/// PHP — é isso que mantém as duas aplicações logadas ao mesmo tempo.
/// </summary>
public record ResultadoAutenticacao(SessaoDto Sessao, int ContaId, string TokenSessao);
