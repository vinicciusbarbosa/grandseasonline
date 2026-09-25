using SugoiGame.Infrastructure.Servicos;

namespace SugoiGame.Tests.Infra;

/// <summary>
/// A compatibilidade de hash é o que permite o PHP e a API validarem a senha da
/// mesma conta enquanto os dois estiverem no ar.
/// </summary>
public class HashSenhaBCryptTests
{
    private readonly HashSenhaBCrypt _hash = new();

    [Fact]
    public void GerarHash_produz_o_mesmo_formato_do_password_hash_do_php()
    {
        var hash = _hash.GerarHash("segredo123");

        // PASSWORD_BCRYPT do PHP gera revisão 2y com custo 10.
        Assert.StartsWith("$2y$10$", hash);
        Assert.Equal(60, hash.Length);
    }

    [Fact]
    public void GerarHash_usa_salt_diferente_a_cada_chamada()
    {
        Assert.NotEqual(_hash.GerarHash("segredo123"), _hash.GerarHash("segredo123"));
    }

    [Fact]
    public void Verificar_aceita_o_hash_que_ele_mesmo_gerou()
    {
        var hash = _hash.GerarHash("segredo123");

        Assert.True(_hash.Verificar("segredo123", hash));
        Assert.False(_hash.Verificar("segredo124", hash));
    }

    [Theory]
    [InlineData('a')]
    [InlineData('b')]
    [InlineData('y')]
    public void Verificar_aceita_hashes_de_qualquer_revisao_do_bcrypt(char revisao)
    {
        // Contas antigas da base podem ter sido gravadas por versões diferentes de
        // PHP/crypt; a verificação não pode depender da revisão.
        var salt = BCrypt.Net.BCrypt.GenerateSalt(10, revisao);
        var hash = BCrypt.Net.BCrypt.HashPassword("segredo123", salt);

        Assert.True(_hash.Verificar("segredo123", hash));
    }

    [Theory]
    [InlineData("")]
    [InlineData("nao-e-um-hash")]
    [InlineData("$2y$10$curto")]
    public void Verificar_trata_hash_invalido_como_senha_errada(string hashInvalido)
    {
        Assert.False(_hash.Verificar("segredo123", hashInvalido));
    }

    [Fact]
    public void Verificar_recusa_senha_vazia()
    {
        var hash = _hash.GerarHash("segredo123");

        Assert.False(_hash.Verificar("", hash));
    }
}
