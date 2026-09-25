namespace SugoiGame.Domain.Enums;

/// <summary>
/// Discriminador da tabela polimórfica <c>tb_usuario_itens</c>: o
/// <c>tipo_item</c> decide em qual tabela de detalhe o <c>cod_item</c> deve ser
/// procurado. Os valores vêm de public/Constantes/itens.php e não podem mudar.
/// </summary>
/// <remarks>
/// Os tipos 8, 9 e 10 (Logia, Paramecia, Zoan) estão comentados no PHP: foram
/// unificados em <see cref="Akuma"/> (19). Os tipos 11 e 1 não existem mais como
/// tabela — comida vem de YAML.
/// </remarks>
public enum TipoItem
{
    Acessorio = 0,
    Comida = 1,
    Mapa = 2,
    Casco = 3,
    Leme = 4,
    Velas = 5,
    Pose = 6,
    Remedio = 7,
    Canhao = 12,
    BalaDeCanhao = 13,
    Equipamento = 14,
    Reagente = 15,
    IscaNormal = 16,
    IscaDourada = 17,
    Missao = 18,
    Akuma = 19,
}
