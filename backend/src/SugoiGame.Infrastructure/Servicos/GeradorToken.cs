using System.Security.Cryptography;
using SugoiGame.Application.Abstractions;

namespace SugoiGame.Infrastructure.Servicos;

/// <summary>
/// Gera os identificadores opacos do schema legado.
/// </summary>
/// <remarks>
/// O formato (hexadecimal, 32 caracteres) é o mesmo do PHP, mas a fonte não:
/// lá eram <c>md5(uniqid(time()))</c> e <c>md5(time())</c>, previsíveis e — no
/// caso do <c>id_encrip</c> — idênticos para dois cadastros no mesmo segundo.
/// Aqui vêm do gerador criptográfico do sistema.
/// </remarks>
public class GeradorToken : IGeradorToken
{
    public string GerarTokenSessao() => HexAleatorio(bytes: 16);

    public string GerarIdEncriptado() => HexAleatorio(bytes: 16);

    /// <summary>Código de ativação de 8 caracteres — o limite da coluna <c>tb_conta.ativacao</c>.</summary>
    public string GerarCodigoAtivacao() => HexAleatorio(bytes: 4);

    private static string HexAleatorio(int bytes) =>
        Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(bytes));
}
