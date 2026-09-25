using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Infrastructure.Persistencia.Configuracoes;

public class ContaConfiguration : IEntityTypeConfiguration<Conta>
{
    public void Configure(EntityTypeBuilder<Conta> builder)
    {
        builder.ToTable("tb_conta");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id).HasColumnName("conta_id").ValueGeneratedOnAdd();
        builder.Property(c => c.IdEncriptado).HasColumnName("id_encrip").HasMaxLength(32).IsRequired();
        builder.Property(c => c.TripulacaoAtivaId).HasColumnName("tripulacao_id");
        builder.Property(c => c.Email).HasColumnName("email").HasMaxLength(255).IsRequired();
        builder.Property(c => c.SenhaHash).HasColumnName("senha").IsRequired();
        builder.Property(c => c.Nome).HasColumnName("nome").HasMaxLength(255).IsRequired();
        builder.Property(c => c.CriadoEm).HasColumnName("cadastro").ValueGeneratedOnAdd();
        builder.Property(c => c.TokenSessao).HasColumnName("cookie").HasMaxLength(32);
        builder.Property(c => c.CodigoAtivacao).HasColumnName("ativacao").HasMaxLength(8);
        builder.Property(c => c.Gold).HasColumnName("gold");
        builder.Property(c => c.FacebookId).HasColumnName("fbid").HasMaxLength(255);
        builder.Property(c => c.Dobroes).HasColumnName("dobroes");
        builder.Property(c => c.DobroesCriados).HasColumnName("dobroes_criados");
        builder.Property(c => c.MedalhasRecrutamento).HasColumnName("medalhas_recrutamento");
        builder.Property(c => c.Beta).HasColumnName("beta");

        builder.HasIndex(c => c.Email).IsUnique();

        // A conta aponta para a tripulação ativa e a tripulação aponta de volta para
        // a conta: são duas relações distintas entre as mesmas tabelas, então cada
        // uma precisa declarar sua própria FK.
        builder.HasOne(c => c.TripulacaoAtiva)
            .WithMany()
            .HasForeignKey(c => c.TripulacaoAtivaId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
