using SugoiGame.Application.Common;

namespace SugoiGame.Api.Extensoes;

/// <summary>Traduz o <see cref="Result"/> da camada de aplicação para respostas HTTP.</summary>
public static class ResultadoHttp
{
    public static IResult ParaHttp<T>(this Result<T> resultado) =>
        resultado.Sucesso ? Results.Ok(resultado.Valor) : Problema(resultado.Erro!.Value);

    public static IResult ParaHttp(this Result resultado) =>
        resultado.Sucesso ? Results.NoContent() : Problema(resultado.Erro!.Value);

    /// <summary>
    /// Devolve um ProblemDetails com o código estável do erro em
    /// <c>extensions.codigo</c>, para o front reagir sem depender do texto.
    /// </summary>
    private static IResult Problema(Erro erro) => Results.Problem(
        detail: erro.Mensagem,
        statusCode: StatusPara(erro.Tipo),
        title: TituloPara(erro.Tipo),
        extensions: new Dictionary<string, object?> { ["codigo"] = erro.Codigo });

    private static int StatusPara(TipoErro tipo) => tipo switch
    {
        TipoErro.Validacao => StatusCodes.Status400BadRequest,
        TipoErro.NaoAutorizado => StatusCodes.Status401Unauthorized,
        TipoErro.NaoEncontrado => StatusCodes.Status404NotFound,
        TipoErro.Conflito => StatusCodes.Status409Conflict,
        _ => StatusCodes.Status400BadRequest,
    };

    private static string TituloPara(TipoErro tipo) => tipo switch
    {
        TipoErro.Validacao => "Requisição inválida",
        TipoErro.NaoAutorizado => "Não autorizado",
        TipoErro.NaoEncontrado => "Não encontrado",
        TipoErro.Conflito => "Conflito",
        _ => "Erro",
    };
}
