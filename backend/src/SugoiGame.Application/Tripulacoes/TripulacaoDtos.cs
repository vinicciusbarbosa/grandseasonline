using SugoiGame.Domain.Enums;

namespace SugoiGame.Application.Tripulacoes;

/// <summary>
/// Dados de criação de tripulação, equivalente ao POST de
/// public/Scripts/Geral/criartrip.php.
/// </summary>
/// <param name="Oceano">
/// Oceano inicial, de 1 a 4. Qualquer outro valor faz o jogo sortear um,
/// mantendo o comportamento do PHP.
/// </param>
public record CriarTripulacaoRequest(
    string NomeTripulacao,
    string NomeCapitao,
    Faccao Faccao,
    int IconeCapitao,
    int Oceano);
