using SugoiGame.Domain.Entities;

namespace SugoiGame.Application.Abstractions;

public interface IContaRepository
{
    Task<Conta?> ObterPorEmailAsync(string email, CancellationToken ct = default);

    Task<Conta?> ObterPorIdAsync(int contaId, CancellationToken ct = default);

    Task<Conta?> ObterPorIdEncriptadoAsync(string idEncriptado, CancellationToken ct = default);

    Task<bool> EmailJaCadastradoAsync(string email, CancellationToken ct = default);

    void Adicionar(Conta conta);

    void AdicionarAfilhado(Afilhado afilhado);
}

public interface ITripulacaoRepository
{
    Task<Tripulacao?> ObterPorIdAsync(int tripulacaoId, CancellationToken ct = default);

    /// <summary>Traz a tripulação já com capitão e VIP carregados, para montar a sessão.</summary>
    Task<Tripulacao?> ObterCompletaAsync(int tripulacaoId, CancellationToken ct = default);

    Task<List<Tripulacao>> ListarPorContaAsync(int contaId, CancellationToken ct = default);

    Task<int> ContarPorContaAsync(int contaId, CancellationToken ct = default);

    Task<bool> NomeJaUsadoAsync(string nome, CancellationToken ct = default);

    void Adicionar(Tripulacao tripulacao);
}

public interface IPersonagemRepository
{
    Task<Personagem?> ObterPorCodAsync(int cod, CancellationToken ct = default);

    Task<List<Personagem>> ListarAtivosDaTripulacaoAsync(int tripulacaoId, CancellationToken ct = default);

    Task<bool> NomeJaUsadoAsync(string nome, CancellationToken ct = default);

    /// <summary>Soma dos níveis de todos os personagens da tripulação.</summary>
    Task<int> SomarNiveisDaTripulacaoAsync(int tripulacaoId, CancellationToken ct = default);

    void Adicionar(Personagem personagem);
}

/// <summary>Confirma as alterações acumuladas pelos repositórios numa única transação.</summary>
public interface IUnidadeDeTrabalho
{
    Task<int> SalvarAsync(CancellationToken ct = default);

    Task ExecutarEmTransacaoAsync(Func<CancellationToken, Task> acao, CancellationToken ct = default);
}
