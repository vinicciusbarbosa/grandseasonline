using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Infrastructure.Persistencia.Configuracoes;

public class AfilhadoConfiguration : IEntityTypeConfiguration<Afilhado>
{
    public void Configure(EntityTypeBuilder<Afilhado> builder)
    {
        builder.ToTable("tb_afilhados");

        // A PK é a conta indicada: cada conta só pode ter um padrinho.
        builder.HasKey(a => a.AfilhadoId);

        builder.Property(a => a.AfilhadoId).HasColumnName("afilhado").ValueGeneratedNever();
        builder.Property(a => a.PadrinhoId).HasColumnName("id");
        builder.Property(a => a.BerriesGanhos).HasColumnName("berries_ganhos");
        builder.Property(a => a.MedalhaGanha).HasColumnName("medalha_ganha");
        builder.Property(a => a.BauGanho).HasColumnName("bau_ganho");
    }
}
