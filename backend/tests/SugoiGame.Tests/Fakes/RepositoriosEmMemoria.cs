using SugoiGame.Application.Abstractions;
using SugoiGame.Domain.Entities;

namespace SugoiGame.Tests.Fakes;

/// <summary>
/// Banco em memória compartilhado pelos fakes de repositório, para testar as
/// regras portadas sem depender de um MySQL de pé.
/// </summary>
public class BancoFake
{
    public List<Conta> Contas { get; } = [];

    public List<Tripulacao> Tripulacoes { get; } = [];

    public List<Personagem> Personagens { get; } = [];

    public List<Afilhado> Afilhados { get; } = [];

    public List<ItemInventario> ItensDeInventario { get; } = [];

    public List<Equipamento> Equipamentos { get; } = [];

    public List<EquipamentosDoPersonagem> EquipamentosDosPersonagens { get; } = [];

    public List<Acessorio> Acessorios { get; } = [];

    public List<NavioDaTripulacao> Navios { get; } = [];

    public int SalvamentosRealizados { get; set; }

    private int _proximoId = 1;

    public int ProximoId() => _proximoId++;
}

public class ContaRepositoryFake(BancoFake banco) : IContaRepository
{
    public Task<Conta?> ObterPorEmailAsync(string email, CancellationToken ct = default) =>
        Task.FromResult(banco.Contas.FirstOrDefault(c => c.Email == email));

    public Task<Conta?> ObterPorIdAsync(int contaId, CancellationToken ct = default) =>
        Task.FromResult(banco.Contas.FirstOrDefault(c => c.Id == contaId));

    public Task<Conta?> ObterPorIdEncriptadoAsync(string idEncriptado, CancellationToken ct = default) =>
        Task.FromResult(banco.Contas.FirstOrDefault(c => c.IdEncriptado == idEncriptado));

    public Task<bool> EmailJaCadastradoAsync(string email, CancellationToken ct = default) =>
        Task.FromResult(banco.Contas.Any(c => c.Email == email));

    public void Adicionar(Conta conta)
    {
        conta.Id = banco.ProximoId();
        banco.Contas.Add(conta);
    }

    public void AdicionarAfilhado(Afilhado afilhado) => banco.Afilhados.Add(afilhado);
}

public class TripulacaoRepositoryFake(BancoFake banco) : ITripulacaoRepository
{
    public Task<Tripulacao?> ObterPorIdAsync(int tripulacaoId, CancellationToken ct = default) =>
        Task.FromResult(banco.Tripulacoes.FirstOrDefault(t => t.Id == tripulacaoId));

    public Task<Tripulacao?> ObterCompletaAsync(int tripulacaoId, CancellationToken ct = default) =>
        ObterPorIdAsync(tripulacaoId, ct);

    public Task<List<Tripulacao>> ListarPorContaAsync(int contaId, CancellationToken ct = default) =>
        Task.FromResult(banco.Tripulacoes.Where(t => t.ContaId == contaId).OrderBy(t => t.Id).ToList());

    public Task<int> ContarPorContaAsync(int contaId, CancellationToken ct = default) =>
        Task.FromResult(banco.Tripulacoes.Count(t => t.ContaId == contaId));

    public Task<bool> NomeJaUsadoAsync(string nome, CancellationToken ct = default) =>
        Task.FromResult(banco.Tripulacoes.Any(t => t.Nome == nome));

    public void Adicionar(Tripulacao tripulacao)
    {
        tripulacao.Id = banco.ProximoId();
        banco.Tripulacoes.Add(tripulacao);
    }
}

public class PersonagemRepositoryFake(BancoFake banco) : IPersonagemRepository
{
    public Task<Personagem?> ObterPorCodAsync(int cod, CancellationToken ct = default) =>
        Task.FromResult(banco.Personagens.FirstOrDefault(p => p.Cod == cod));

    public Task<List<Personagem>> ListarAtivosDaTripulacaoAsync(int tripulacaoId, CancellationToken ct = default) =>
        Task.FromResult(banco.Personagens.Where(p => p.TripulacaoId == tripulacaoId && p.Ativo).ToList());

    public Task<bool> NomeJaUsadoAsync(string nome, CancellationToken ct = default) =>
        Task.FromResult(banco.Personagens.Any(p => p.Nome == nome));

    public Task<int> SomarNiveisDaTripulacaoAsync(int tripulacaoId, CancellationToken ct = default) =>
        Task.FromResult(banco.Personagens.Where(p => p.TripulacaoId == tripulacaoId).Sum(p => p.Lvl));

    public void Adicionar(Personagem personagem)
    {
        personagem.Cod = banco.ProximoId();
        banco.Personagens.Add(personagem);
    }
}

public class UnidadeDeTrabalhoFake(BancoFake banco) : IUnidadeDeTrabalho
{
    public Task<int> SalvarAsync(CancellationToken ct = default)
    {
        banco.SalvamentosRealizados++;

        return Task.FromResult(0);
    }

    public Task ExecutarEmTransacaoAsync(Func<CancellationToken, Task> acao, CancellationToken ct = default) => acao(ct);
}

public class EnviadorEmailFake : IEnviadorEmail
{
    public List<(string Email, string Codigo)> Enviados { get; } = [];

    public Task EnviarAtivacaoAsync(string email, string nome, int contaId, string codigoAtivacao, CancellationToken ct = default)
    {
        Enviados.Add((email, codigoAtivacao));

        return Task.CompletedTask;
    }
}

public class RelogioFake : IRelogio
{
    public DateTime Agora { get; set; } = new(2026, 8, 25, 12, 0, 0, DateTimeKind.Unspecified);

    public double TimestampUnix { get; set; } = 1_787_000_000;
}

public class EquipamentoRepositoryFake(BancoFake banco) : IEquipamentoRepository
{
    public Task<Equipamento?> ObterAsync(int cod, CancellationToken ct = default) =>
        Task.FromResult(banco.Equipamentos.FirstOrDefault(e => e.Cod == cod));

    public Task<List<Equipamento>> ListarPorCodigosAsync(IReadOnlyCollection<int> codigos, CancellationToken ct = default) =>
        Task.FromResult(banco.Equipamentos.Where(e => codigos.Contains(e.Cod)).ToList());

    public Task<EquipamentosDoPersonagem> ObterOuCriarDoPersonagemAsync(int personagemCod, CancellationToken ct = default)
    {
        var existente = banco.EquipamentosDosPersonagens.FirstOrDefault(e => e.PersonagemCod == personagemCod);
        if (existente is null)
        {
            existente = new EquipamentosDoPersonagem { PersonagemCod = personagemCod };
            banco.EquipamentosDosPersonagens.Add(existente);
        }

        return Task.FromResult(existente);
    }

    public Task<Acessorio?> ObterAcessorioAsync(int cod, CancellationToken ct = default) =>
        Task.FromResult(banco.Acessorios.FirstOrDefault(a => a.Cod == cod));

    public Task<IReadOnlyDictionary<int, EquipamentosDoPersonagem>> ObterDeVariosAsync(
        IReadOnlyCollection<int> personagemCods,
        CancellationToken ct = default)
    {
        IReadOnlyDictionary<int, EquipamentosDoPersonagem> mapa = banco.EquipamentosDosPersonagens
            .Where(e => personagemCods.Contains(e.PersonagemCod))
            .ToDictionary(e => e.PersonagemCod);

        return Task.FromResult(mapa);
    }

    public Task<IReadOnlyDictionary<int, Acessorio>> ListarAcessoriosAsync(
        IReadOnlyCollection<int> codigos,
        CancellationToken ct = default)
    {
        IReadOnlyDictionary<int, Acessorio> mapa = banco.Acessorios
            .Where(a => codigos.Contains(a.Cod))
            .ToDictionary(a => a.Cod);

        return Task.FromResult(mapa);
    }
}

public class NavioRepositoryFake(BancoFake banco) : INavioRepository
{
    public Task<NavioDaTripulacao?> ObterDaTripulacaoAsync(int tripulacaoId, CancellationToken ct = default) =>
        Task.FromResult(banco.Navios.FirstOrDefault(n => n.TripulacaoId == tripulacaoId));
}
