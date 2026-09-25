using SugoiGame.Application.Abstractions;

namespace SugoiGame.Infrastructure.Servicos;

/// <summary>
/// Hash bcrypt compatível com o <c>password_hash()</c>/<c>password_verify()</c> do PHP.
/// </summary>
/// <remarks>
/// Enquanto o legado estiver no ar, os dois lados precisam ler o hash um do outro:
/// os hashes gerados aqui usam a revisão <c>$2y$</c> e custo 10, exatamente o que
/// <c>PASSWORD_BCRYPT</c> produz por padrão. A verificação aceita qualquer revisão
/// ($2a$, $2b$, $2x$, $2y$), então contas antigas continuam entrando.
/// </remarks>
public class HashSenhaBCrypt : IHashSenha
{
    private const int Custo = 10;

    private const char RevisaoPhp = 'y';

    public string GerarHash(string senha)
    {
        ArgumentException.ThrowIfNullOrEmpty(senha);

        var salt = BCrypt.Net.BCrypt.GenerateSalt(Custo, RevisaoPhp);

        return BCrypt.Net.BCrypt.HashPassword(senha, salt);
    }

    public bool Verificar(string senha, string hash)
    {
        if (string.IsNullOrEmpty(senha) || string.IsNullOrEmpty(hash))
        {
            return false;
        }

        try
        {
            return BCrypt.Net.BCrypt.Verify(senha, hash);
        }
        catch (Exception e) when (e is BCrypt.Net.SaltParseException or ArgumentException or FormatException)
        {
            // Hash corrompido, truncado ou num formato que o bcrypt não reconhece:
            // trata como senha errada em vez de derrubar a requisição com 500.
            return false;
        }
    }
}
