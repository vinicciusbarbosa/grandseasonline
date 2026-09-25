using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Infrastructure.Persistencia.Configuracoes;

/// <summary>
/// Mapeia <see cref="Tripulacao"/> para <c>tb_usuarios</c> — o nome da tabela
/// legada não corresponde ao conceito que ela guarda.
/// </summary>
public class TripulacaoConfiguration : IEntityTypeConfiguration<Tripulacao>
{
    public void Configure(EntityTypeBuilder<Tripulacao> builder)
    {
        builder.ToTable("tb_usuarios");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id).HasColumnName("id").ValueGeneratedOnAdd();
        builder.Property(t => t.ContaId).HasColumnName("conta_id");
        builder.Property(t => t.Nome).HasColumnName("tripulacao").HasMaxLength(15).IsRequired();
        builder.Property(t => t.CriadaEm).HasColumnName("cadastro").ValueGeneratedOnAdd();
        builder.Property(t => t.UltimoLogon).HasColumnName("ultimo_logon");
        builder.Property(t => t.Faccao).HasColumnName("faccao").HasConversion<int>();
        builder.Property(t => t.Reputacao).HasColumnName("reputacao");
        builder.Property(t => t.ReputacaoMensal).HasColumnName("reputacao_mensal");
        builder.Property(t => t.Berries).HasColumnName("berries");
        builder.Property(t => t.CapitaoCod).HasColumnName("cod_personagem");
        builder.Property(t => t.X).HasColumnName("x");
        builder.Property(t => t.Y).HasColumnName("y");
        builder.Property(t => t.RespawnX).HasColumnName("res_x");
        builder.Property(t => t.RespawnY).HasColumnName("res_y");
        builder.Property(t => t.Vitorias).HasColumnName("vitorias");
        builder.Property(t => t.Derrotas).HasColumnName("derrotas");
        builder.Property(t => t.Fugas).HasColumnName("fugas");
        builder.Property(t => t.Bandeira).HasColumnName("bandeira").HasMaxLength(36).IsRequired();
        builder.Property(t => t.Disposicao).HasColumnName("disposicao");
        builder.Property(t => t.KarmaBom).HasColumnName("karma_bom");
        builder.Property(t => t.KarmaMau).HasColumnName("karma_mau");
        builder.Property(t => t.BattlePoints).HasColumnName("battle_points");
        builder.Property(t => t.BattleLvl).HasColumnName("battle_lvl");
        builder.Property(t => t.Adm).HasColumnName("adm");
        builder.Property(t => t.Inativo).HasColumnName("inativo");

        builder.HasIndex(t => t.Nome).IsUnique();

        builder.HasOne(t => t.Conta)
            .WithMany(c => c.Tripulacoes)
            .HasForeignKey(t => t.ContaId)
            .OnDelete(DeleteBehavior.Cascade);

        // cod_personagem não tem FK declarada no schema legado; aqui ela só existe
        // como relação do modelo, para permitir Include do capitão.
        builder.HasOne(t => t.Capitao)
            .WithMany()
            .HasForeignKey(t => t.CapitaoCod)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(t => t.Vip)
            .WithOne(v => v.Tripulacao)
            .HasForeignKey<Vip>(v => v.TripulacaoId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
