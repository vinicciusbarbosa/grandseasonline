namespace SugoiGame.Domain.Enums;

/// <summary>
/// Onde um equipamento pode ser vestido. Portado de nome_slot() em
/// public/Funcoes/equipamentos.php.
/// </summary>
/// <remarks>
/// Atenção: os valores 1 a 8 são ao mesmo tempo o slot do corpo e o nome da
/// coluna em <c>tb_personagem_equipamentos</c>. Já <see cref="UmaMao"/> (9) e
/// <see cref="DuasMaos"/> (10) não são posições: são a <i>exigência</i> de um
/// item, gravada em <c>tb_item_equipamentos.slot</c>. Uma arma de uma mão pode
/// ir para a primeira ou a segunda mão; uma de duas mãos ocupa as duas.
/// </remarks>
public enum SlotEquipamento
{
    Cabeca = 1,
    Colete = 2,
    Calcas = 3,
    Botas = 4,
    Luvas = 5,
    Capa = 6,
    PrimeiraMao = 7,
    SegundaMao = 8,

    /// <summary>Exigência de item, não posição: cabe na primeira ou na segunda mão.</summary>
    UmaMao = 9,

    /// <summary>Exigência de item, não posição: ocupa as duas mãos ao mesmo tempo.</summary>
    DuasMaos = 10,
}
