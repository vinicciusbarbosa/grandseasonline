namespace SugoiGame.Application.Common;

/// <summary>
/// Falha de negócio. <see cref="Codigo"/> é estável e serve para o front reagir
/// programaticamente; <see cref="Mensagem"/> é o texto exibido ao jogador.
/// </summary>
public readonly record struct Erro(string Codigo, string Mensagem, TipoErro Tipo = TipoErro.Validacao)
{
    public static Erro Validacao(string codigo, string mensagem) => new(codigo, mensagem, TipoErro.Validacao);

    public static Erro NaoAutorizado(string codigo, string mensagem) => new(codigo, mensagem, TipoErro.NaoAutorizado);

    public static Erro NaoEncontrado(string codigo, string mensagem) => new(codigo, mensagem, TipoErro.NaoEncontrado);

    public static Erro Conflito(string codigo, string mensagem) => new(codigo, mensagem, TipoErro.Conflito);
}

public enum TipoErro
{
    Validacao,
    NaoAutorizado,
    NaoEncontrado,
    Conflito,
}

/// <summary>Resultado de uma operação que pode falhar sem produzir valor.</summary>
public class Result
{
    protected Result(Erro? erro) => Erro = erro;

    public Erro? Erro { get; }

    public bool Sucesso => Erro is null;

    public bool Falhou => !Sucesso;

    public static Result Ok() => new(null);

    public static Result Falha(Erro erro) => new(erro);

    public static Result<T> Ok<T>(T valor) => Result<T>.Ok(valor);

    public static Result<T> Falha<T>(Erro erro) => Result<T>.Falha(erro);
}

/// <summary>Resultado de uma operação que produz um valor quando bem-sucedida.</summary>
public sealed class Result<T> : Result
{
    private readonly T? _valor;

    private Result(T? valor, Erro? erro) : base(erro) => _valor = valor;

    /// <summary>Valor produzido. Só pode ser lido quando <see cref="Result.Sucesso"/> é verdadeiro.</summary>
    public T Valor => Sucesso
        ? _valor!
        : throw new InvalidOperationException($"Result falhou ({Erro!.Value.Codigo}); não há valor para ler.");

    public static Result<T> Ok(T valor) => new(valor, null);

    public static new Result<T> Falha(Erro erro) => new(default, erro);
}
