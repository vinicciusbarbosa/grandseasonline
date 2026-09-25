using SugoiGame.Domain.Enums;

namespace SugoiGame.Application.Status;

/// <summary>Um atributo com rótulo, efeito, valor base e bônus.</summary>
/// <param name="Valor">Pontos investidos pelo jogador.</param>
/// <param name="Bonus">
/// Somatório de equipamentos, acessório e Haki. É fracionário: os equipamentos
/// rendem bônus com duas casas decimais.
/// </param>
public record AtributoDto(
    Atributo Atributo,
    string Sigla,
    string Nome,
    string Descricao,
    int Valor,
    decimal Bonus)
{
    public decimal Total => Valor + Bonus;
}

/// <summary>Progresso de Haki do personagem.</summary>
public record HakiDto(
    int Lvl,
    int Xp,
    int XpMax,
    int PontosDisponiveis,
    int Esquiva,
    int Bloqueio,
    int Critico,
    uint Hdr);

public record ProfissaoDto(int Codigo, int Lvl, double Xp, double XpMax);

/// <summary>
/// Ficha completa de um personagem — o que a tela de status precisa.
/// </summary>
/// <param name="PontosDisponiveis">Pontos de atributo ainda não distribuídos.</param>
/// <param name="PodeEvoluir">Verdadeiro quando há XP suficiente e o nível máximo não foi atingido.</param>
public record PersonagemStatusDto(
    int Cod,
    string Nome,
    int Img,
    uint SkinCorpo,
    uint SkinRosto,
    int Sexo,
    int Lvl,
    int Xp,
    int XpMax,
    uint Hp,
    uint HpMax,
    uint Mp,
    uint MpMax,
    uint FamaAmeaca,
    int? TituloCod,
    int Classe,
    int? AkumaCod,
    bool Ativo,
    bool EhCapitao,
    bool PodeEvoluir,
    int PontosDisponiveis,
    IReadOnlyList<AtributoDto> Atributos,
    HakiDto Haki,
    ProfissaoDto Profissao);

public record DistribuirPontosRequest(Atributo Atributo, int Quantidade);
