using SugoiGame.Application.Abstractions;

namespace SugoiGame.Infrastructure.Servicos;

/// <summary>
/// Relógio do jogo. O legado roda inteiro em America/Sao_Paulo
/// (date_default_timezone_set em Includes/conectdb.php) e grava timestamps unix
/// em várias colunas, então os dois formatos precisam continuar batendo.
/// </summary>
public class RelogioSistema : IRelogio
{
    private static readonly TimeZoneInfo FusoDoJogo = ResolverFuso();

    public DateTime Agora => TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, FusoDoJogo).DateTime;

    public double TimestampUnix => DateTimeOffset.UtcNow.ToUnixTimeSeconds();

    /// <summary>
    /// Windows e Linux usam bases de fuso diferentes; tenta o id de cada uma
    /// antes de desistir para o horário local da máquina.
    /// </summary>
    private static TimeZoneInfo ResolverFuso()
    {
        foreach (var id in (string[])["America/Sao_Paulo", "E. South America Standard Time"])
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
                // Tenta o próximo id.
            }
            catch (InvalidTimeZoneException)
            {
                // Base de fusos corrompida; tenta o próximo id.
            }
        }

        return TimeZoneInfo.Local;
    }
}
