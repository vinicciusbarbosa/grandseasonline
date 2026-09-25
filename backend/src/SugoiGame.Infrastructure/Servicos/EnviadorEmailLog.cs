using Microsoft.Extensions.Logging;
using SugoiGame.Application.Abstractions;

namespace SugoiGame.Infrastructure.Servicos;

/// <summary>
/// Implementação de desenvolvimento: escreve o e-mail de ativação no log em vez
/// de enviá-lo.
/// </summary>
/// <remarks>
/// O legado enviava por SMTP direto com a PHPMailer embutida em
/// Classes/PHPMailer.php. Trocar isso por um provedor de verdade é uma decisão
/// de infraestrutura à parte — até lá, o código de ativação sai no log para dar
/// para testar o cadastro ponta a ponta.
/// </remarks>
public class EnviadorEmailLog(ILogger<EnviadorEmailLog> logger) : IEnviadorEmail
{
    public Task EnviarAtivacaoAsync(
        string email,
        string nome,
        int contaId,
        string codigoAtivacao,
        CancellationToken ct = default)
    {
        logger.LogInformation(
            "E-mail de ativação não enviado (sem provedor SMTP configurado). Destinatário: {Email} ({Nome}), conta {ContaId}, código de ativação: {Codigo}",
            email,
            nome,
            contaId,
            codigoAtivacao);

        return Task.CompletedTask;
    }
}
