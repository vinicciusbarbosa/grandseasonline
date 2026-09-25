using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Infrastructure.Persistencia.Configuracoes;

public class ItemInventarioConfiguration : IEntityTypeConfiguration<ItemInventario>
{
    public void Configure(EntityTypeBuilder<ItemInventario> builder)
    {
        builder.ToTable("tb_usuario_itens");

        builder.HasKey(i => i.Id);

        // A PK da tabela legada se chama "okok" e é o auto increment; "id" é a FK
        // da tripulação. Os nomes enganam, então ambos são mapeados à mão.
        builder.Property(i => i.Id).HasColumnName("okok").ValueGeneratedOnAdd();
        builder.Property(i => i.TripulacaoId).HasColumnName("id");
        builder.Property(i => i.CodItem).HasColumnName("cod_item");
        builder.Property(i => i.Tipo).HasColumnName("tipo_item").HasConversion<int>();
        builder.Property(i => i.Quantidade).HasColumnName("quant");
        builder.Property(i => i.Novo).HasColumnName("novo");

        builder.HasIndex(i => new { i.TripulacaoId, i.CodItem, i.Tipo });

        builder.HasOne(i => i.Tripulacao)
            .WithMany()
            .HasForeignKey(i => i.TripulacaoId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class EquipamentoConfiguration : IEntityTypeConfiguration<Equipamento>
{
    public void Configure(EntityTypeBuilder<Equipamento> builder)
    {
        builder.ToTable("tb_item_equipamentos");

        builder.HasKey(e => e.Cod);

        builder.Property(e => e.Cod).HasColumnName("cod_equipamento").ValueGeneratedOnAdd();
        builder.Property(e => e.ItemBase).HasColumnName("item");
        builder.Property(e => e.Nome).HasColumnName("nome").HasMaxLength(100).IsRequired();
        builder.Property(e => e.Descricao).HasColumnName("descricao").IsRequired();
        builder.Property(e => e.Img).HasColumnName("img");
        builder.Property(e => e.CategoriaDano).HasColumnName("cat_dano");
        builder.Property(e => e.BonusPrimarioAtributo).HasColumnName("b_1");
        builder.Property(e => e.BonusSecundarioAtributo).HasColumnName("b_2");
        builder.Property(e => e.Categoria).HasColumnName("categoria");
        builder.Property(e => e.Lvl).HasColumnName("lvl");
        builder.Property(e => e.Upgrade).HasColumnName("upgrade");
        builder.Property(e => e.TreinoMax).HasColumnName("treino_max");
        builder.Property(e => e.Slot).HasColumnName("slot").HasConversion<int>();
        builder.Property(e => e.Requisito).HasColumnName("requisito");

        builder.HasIndex(e => e.ItemBase);
    }
}

/// <summary>
/// As colunas de <c>tb_personagem_equipamentos</c> se chamam literalmente "1" a
/// "8" — um por slot do corpo.
/// </summary>
public class EquipamentosDoPersonagemConfiguration : IEntityTypeConfiguration<EquipamentosDoPersonagem>
{
    public void Configure(EntityTypeBuilder<EquipamentosDoPersonagem> builder)
    {
        builder.ToTable("tb_personagem_equipamentos");

        builder.HasKey(e => e.PersonagemCod);

        builder.Property(e => e.PersonagemCod).HasColumnName("cod").ValueGeneratedNever();
        builder.Property(e => e.Cabeca).HasColumnName("1");
        builder.Property(e => e.Colete).HasColumnName("2");
        builder.Property(e => e.Calcas).HasColumnName("3");
        builder.Property(e => e.Botas).HasColumnName("4");
        builder.Property(e => e.Luvas).HasColumnName("5");
        builder.Property(e => e.Capa).HasColumnName("6");
        builder.Property(e => e.PrimeiraMao).HasColumnName("7");
        builder.Property(e => e.SegundaMao).HasColumnName("8");

        builder.Ignore(e => e.SeguraArmaDeDuasMaos);

        builder.HasOne(e => e.Personagem)
            .WithOne()
            .HasForeignKey<EquipamentosDoPersonagem>(e => e.PersonagemCod)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class TreinoEquipamentoConfiguration : IEntityTypeConfiguration<TreinoEquipamento>
{
    public void Configure(EntityTypeBuilder<TreinoEquipamento> builder)
    {
        builder.ToTable("tb_personagem_equip_treino");

        builder.HasKey(t => new { t.PersonagemCod, t.ItemBase });

        builder.Property(t => t.PersonagemCod).HasColumnName("cod");
        builder.Property(t => t.ItemBase).HasColumnName("item");
        builder.Property(t => t.Xp).HasColumnName("xp");
    }
}

public class AcessorioConfiguration : IEntityTypeConfiguration<Acessorio>
{
    public void Configure(EntityTypeBuilder<Acessorio> builder)
    {
        builder.ToTable("tb_item_acessorio");

        builder.HasKey(a => a.Cod);

        builder.Property(a => a.Cod).HasColumnName("cod_acessorio").ValueGeneratedOnAdd();
        builder.Property(a => a.Nome).HasColumnName("nome").HasMaxLength(30).IsRequired();
        builder.Property(a => a.Descricao).HasColumnName("descricao").IsRequired();
        builder.Property(a => a.BonusAtributo).HasColumnName("bonus_atr");
        builder.Property(a => a.BonusQuantidade).HasColumnName("bonus_atr_qnt");
        builder.Property(a => a.Img).HasColumnName("img");
        builder.Property(a => a.Mergulho).HasColumnName("mergulho");
    }
}

/// <summary>Mapeamento parcial: só a capacidade de carga interessa a esta fatia.</summary>
public class NavioDaTripulacaoConfiguration : IEntityTypeConfiguration<NavioDaTripulacao>
{
    public void Configure(EntityTypeBuilder<NavioDaTripulacao> builder)
    {
        builder.ToTable("tb_usuario_navio");

        builder.HasKey(n => n.TripulacaoId);

        builder.Property(n => n.TripulacaoId).HasColumnName("id").ValueGeneratedNever();
        builder.Property(n => n.CodNavio).HasColumnName("cod_navio");
        builder.Property(n => n.CapacidadeInventario).HasColumnName("capacidade_inventario");
        builder.Property(n => n.Lvl).HasColumnName("lvl");

        builder.HasOne(n => n.Tripulacao)
            .WithOne()
            .HasForeignKey<NavioDaTripulacao>(n => n.TripulacaoId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ReagenteConfiguration : IEntityTypeConfiguration<Reagente>
{
    public void Configure(EntityTypeBuilder<Reagente> builder)
    {
        builder.ToTable("tb_item_reagents");

        builder.HasKey(r => r.Cod);

        builder.Property(r => r.Cod).HasColumnName("cod_reagent").ValueGeneratedOnAdd();
        builder.Property(r => r.Nome).HasColumnName("nome").HasMaxLength(100).IsRequired();
        builder.Property(r => r.Descricao).HasColumnName("descricao").IsRequired();
        builder.Property(r => r.Img).HasColumnName("img");
        builder.Property(r => r.ImgFormato).HasColumnName("img_format").HasMaxLength(5);
        builder.Property(r => r.Preco).HasColumnName("preco");
    }
}

public class ItemDeMissaoConfiguration : IEntityTypeConfiguration<ItemDeMissao>
{
    public void Configure(EntityTypeBuilder<ItemDeMissao> builder)
    {
        builder.ToTable("tb_item_missao");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id).HasColumnName("id").ValueGeneratedOnAdd();
        builder.Property(i => i.Nome).HasColumnName("nome").HasMaxLength(100);
        builder.Property(i => i.Descricao).HasColumnName("descricao");
        builder.Property(i => i.Img).HasColumnName("img");
        builder.Property(i => i.ImgFormato).HasColumnName("img_format").HasMaxLength(5);
    }
}
