namespace SugoiGame.Domain.Entities;

/// <summary>
/// XP de treino de um personagem com um modelo de equipamento. Mapeia
/// <c>tb_personagem_equip_treino</c>.
/// </summary>
/// <remarks>
/// A chave é (personagem, modelo) — o treino acompanha o <i>modelo</i>
/// (<see cref="Equipamento.ItemBase"/>), não a instância, então trocar de espada
/// pelo mesmo tipo de espada não zera o progresso.
/// <para>
/// No legado o multiplicador derivado deste XP está fixo em 1
/// (<c>$treinos[$slot]["porcent"] = 1</c> em load_equipamentos), ou seja, o
/// sistema está desligado. A tabela é mapeada porque os dados existem, mas o
/// cálculo de bônus ainda não a usa — ver <see cref="BonusAtributos"/>.
/// </para>
/// </remarks>
public class TreinoEquipamento
{
    public int PersonagemCod { get; set; }

    /// <summary>Modelo do equipamento treinado (coluna <c>item</c>).</summary>
    public int ItemBase { get; set; }

    public uint Xp { get; set; }
}
