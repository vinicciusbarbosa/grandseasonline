using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Infrastructure.Persistencia.Configuracoes;

public class VipConfiguration : IEntityTypeConfiguration<Vip>
{
    public void Configure(EntityTypeBuilder<Vip> builder)
    {
        builder.ToTable("tb_vip");

        builder.HasKey(v => v.TripulacaoId);

        // A PK também é a FK da tripulação, então nunca é gerada pelo banco.
        builder.Property(v => v.TripulacaoId).HasColumnName("id").ValueGeneratedNever();

        builder.Property(v => v.Luneta).HasColumnName("luneta");
        builder.Property(v => v.LunetaDuracao).HasColumnName("luneta_duracao");
        builder.Property(v => v.Sense).HasColumnName("sense");
        builder.Property(v => v.SenseDuracao).HasColumnName("sense_duracao");
        builder.Property(v => v.Tatic).HasColumnName("tatic");
        builder.Property(v => v.TaticDuracao).HasColumnName("tatic_duracao");
        builder.Property(v => v.ResetPersonagem).HasColumnName("reset_personagem");
        builder.Property(v => v.ResetNome).HasColumnName("reset_nome");
        builder.Property(v => v.Conhecimento).HasColumnName("conhecimento");
        builder.Property(v => v.ConhecimentoDuracao).HasColumnName("conhecimento_duracao");
        builder.Property(v => v.CoupDeBurst).HasColumnName("coup_de_burst");
        builder.Property(v => v.CoupDeBurstDuracao).HasColumnName("coup_de_burst_duracao");
        builder.Property(v => v.Formacoes).HasColumnName("formacoes");
        builder.Property(v => v.FormacoesDuracao).HasColumnName("formacoes_duracao");
    }
}
