namespace SugoiGame.Application.Abstractions;

/// <summary>
/// Hash de senha compatível com o <c>password_hash()</c> do PHP, que grava
/// bcrypt com prefixo <c>$2y$</c>. A verificação precisa aceitar hashes
/// antigos gerados pelo PHP e os novos gerados aqui.
/// </summary>
public interface IHashSenha
{
    string GerarHash(string senha);

    bool Verificar(string senha, string hash);
}

/// <summary>
/// Gera os identificadores opacos que o schema legado espera: tokens de sessão
/// e o <c>id_encrip</c>, ambos de 32 caracteres hexadecimais.
/// </summary>
public interface IGeradorToken
{
    /// <summary>Token de sessão gravado em <c>tb_conta.cookie</c> e enviado no cookie <c>sg_k</c>.</summary>
    string GerarTokenSessao();

    /// <summary>Identificador público da conta, usado como código de indicação.</summary>
    string GerarIdEncriptado();

    /// <summary>Código de ativação por e-mail, 8 caracteres.</summary>
    string GerarCodigoAtivacao();
}

/// <summary>Fonte de tempo injetável — o jogo grava timestamps unix em várias tabelas.</summary>
public interface IRelogio
{
    DateTime Agora { get; }

    double TimestampUnix { get; }
}

public interface IEnviadorEmail
{
    Task EnviarAtivacaoAsync(string email, string nome, int contaId, string codigoAtivacao, CancellationToken ct = default);
}

/// <summary>Identidade resolvida a partir dos cookies da requisição atual.</summary>
public interface IUsuarioAtual
{
    int? ContaId { get; }

    int? TripulacaoId { get; }

    bool EstaAutenticado { get; }
}
