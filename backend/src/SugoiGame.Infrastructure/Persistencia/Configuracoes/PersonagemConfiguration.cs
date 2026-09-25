using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Infrastructure.Persistencia.Configuracoes;

/// <summary>
/// Mapeia <see cref="Personagem"/> para <c>tb_personagens</c>. Atenção à
/// inversão do schema legado: <c>cod</c> é a PK e <c>id</c> é a FK da tripulação.
/// </summary>
public class PersonagemConfiguration : IEntityTypeConfiguration<Personagem>
{
    public void Configure(EntityTypeBuilder<Personagem> builder)
    {
        builder.ToTable("tb_personagens");

        builder.HasKey(p => p.Cod);

        builder.Property(p => p.Cod).HasColumnName("cod").ValueGeneratedOnAdd();
        builder.Property(p => p.TripulacaoId).HasColumnName("id");
        builder.Property(p => p.Nome).HasColumnName("nome").HasMaxLength(15).IsRequired();
        builder.Property(p => p.Img).HasColumnName("img");
        builder.Property(p => p.SkinCorpo).HasColumnName("skin_c");
        builder.Property(p => p.SkinRosto).HasColumnName("skin_r");
        builder.Property(p => p.Hp).HasColumnName("hp");
        builder.Property(p => p.HpMax).HasColumnName("hp_max");
        builder.Property(p => p.Mp).HasColumnName("mp");
        builder.Property(p => p.MpMax).HasColumnName("mp_max");
        builder.Property(p => p.Xp).HasColumnName("xp");
        builder.Property(p => p.XpMax).HasColumnName("xp_max");
        builder.Property(p => p.FamaAmeaca).HasColumnName("fama_ameaca");
        builder.Property(p => p.Lvl).HasColumnName("lvl");
        builder.Property(p => p.TituloCod).HasColumnName("titulo");
        builder.Property(p => p.Classe).HasColumnName("classe");
        builder.Property(p => p.Profissao).HasColumnName("profissao");
        builder.Property(p => p.ProfissaoLvl).HasColumnName("profissao_lvl");
        builder.Property(p => p.ProfissaoXp).HasColumnName("profissao_xp");
        builder.Property(p => p.ProfissaoXpMax).HasColumnName("profissao_xp_max");
        builder.Property(p => p.AkumaCod).HasColumnName("akuma");

        builder.Property(p => p.Atk).HasColumnName("atk");
        builder.Property(p => p.Def).HasColumnName("def");
        builder.Property(p => p.Agl).HasColumnName("agl");
        builder.Property(p => p.Res).HasColumnName("res");
        builder.Property(p => p.Pre).HasColumnName("pre");
        builder.Property(p => p.Dex).HasColumnName("dex");
        builder.Property(p => p.Con).HasColumnName("con");
        builder.Property(p => p.Vit).HasColumnName("vit");
        builder.Property(p => p.Pts).HasColumnName("pts");

        builder.Property(p => p.HakiLvl).HasColumnName("haki_lvl");
        builder.Property(p => p.HakiXp).HasColumnName("haki_xp");
        builder.Property(p => p.HakiXpMax).HasColumnName("haki_xp_max");
        builder.Property(p => p.HakiPts).HasColumnName("haki_pts");
        builder.Property(p => p.HakiEsquiva).HasColumnName("haki_esq");
        builder.Property(p => p.HakiBloqueio).HasColumnName("haki_blo");
        builder.Property(p => p.HakiCritico).HasColumnName("haki_cri");
        builder.Property(p => p.HakiHdr).HasColumnName("haki_hdr");

        builder.Property(p => p.Respawn).HasColumnName("respawn");
        builder.Property(p => p.Ativo).HasColumnName("ativo");
        builder.Property(p => p.Preso).HasColumnName("preso");
        builder.Property(p => p.Sexo).HasColumnName("sexo");
        builder.Property(p => p.CodAcessorio).HasColumnName("cod_acessorio");

        builder.Ignore(p => p.EstaVivo);
        builder.Ignore(p => p.PodeEvoluir);

        builder.HasIndex(p => p.Nome).IsUnique();

        builder.HasOne(p => p.Tripulacao)
            .WithMany(t => t.Personagens)
            .HasForeignKey(p => p.TripulacaoId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
