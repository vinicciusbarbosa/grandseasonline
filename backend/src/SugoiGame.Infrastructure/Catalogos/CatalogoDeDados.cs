using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SugoiGame.Domain;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace SugoiGame.Infrastructure.Catalogos;

/// <summary>
/// Catálogos de itens que não moram no banco.
/// </summary>
/// <remarks>
/// Comida, remédio e akuma são definidos em arquivos de dados em public/Data, e
/// o PHP os lê pelo MapLoader/DataLoader. São dados de balanceamento, versionados
/// junto com o código e imutáveis em runtime — por isso ficam em cache de
/// processo, carregados uma vez na primeira consulta.
/// <para>
/// O arquivo de akumas tem entradas comentadas (frutas desativadas); o parser de
/// YAML simplesmente não as enxerga, que é o comportamento desejado.
/// </para>
/// </remarks>
public class CatalogoDeDados
{
    private readonly string _pasta;
    private readonly ILogger<CatalogoDeDados> _logger;
    private readonly Lock _trava = new();

    private IReadOnlyDictionary<int, DetalheItem>? _comidas;
    private IReadOnlyDictionary<int, DetalheItem>? _remedios;
    private IReadOnlyDictionary<int, DetalheItem>? _akumas;

    private static readonly JsonSerializerOptions OpcoesJson = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public CatalogoDeDados(IConfiguration configuration, IHostAmbiente ambiente, ILogger<CatalogoDeDados> logger)
    {
        _logger = logger;

        var configurado = configuration["Assets:PastaDados"];

        _pasta = string.IsNullOrWhiteSpace(configurado)
            ? Path.GetFullPath(Path.Combine(ambiente.RaizDoConteudo, "..", "..", "..", "public", "Data"))
            : Path.GetFullPath(configurado);
    }

    public IReadOnlyDictionary<int, DetalheItem> Comidas =>
        Carregar(ref _comidas, "comidas.json", LerComidas);

    public IReadOnlyDictionary<int, DetalheItem> Remedios =>
        Carregar(ref _remedios, "remedios.json", LerRemedios);

    public IReadOnlyDictionary<int, DetalheItem> Akumas =>
        Carregar(ref _akumas, "akumas.yaml", LerAkumas);

    private IReadOnlyDictionary<int, DetalheItem> Carregar(
        ref IReadOnlyDictionary<int, DetalheItem>? campo,
        string arquivo,
        Func<string, IReadOnlyDictionary<int, DetalheItem>> ler)
    {
        if (campo is not null)
        {
            return campo;
        }

        lock (_trava)
        {
            if (campo is not null)
            {
                return campo;
            }

            var caminho = Path.Combine(_pasta, arquivo);

            if (!File.Exists(caminho))
            {
                _logger.LogWarning(
                    "Catálogo {Arquivo} não encontrado em {Pasta}; os itens desse tipo aparecerão como desconhecidos.",
                    arquivo,
                    _pasta);

                return campo = new Dictionary<int, DetalheItem>();
            }

            try
            {
                return campo = ler(File.ReadAllText(caminho));
            }
            catch (Exception e) when (e is JsonException or YamlDotNet.Core.YamlException)
            {
                // Catálogo malformado não pode derrubar o inventário inteiro.
                _logger.LogError(e, "Falha ao ler o catálogo {Arquivo}.", arquivo);

                return campo = new Dictionary<int, DetalheItem>();
            }
        }
    }

    private static IReadOnlyDictionary<int, DetalheItem> LerComidas(string conteudo) =>
        (JsonSerializer.Deserialize<List<ComidaJson>>(conteudo, OpcoesJson) ?? [])
        .GroupBy(c => c.CodComida)
        .ToDictionary(
            g => g.Key,
            g => new DetalheItem(g.First().Nome, g.First().Descricao ?? string.Empty, g.First().Img));

    private static IReadOnlyDictionary<int, DetalheItem> LerRemedios(string conteudo) =>
        (JsonSerializer.Deserialize<List<RemedioJson>>(conteudo, OpcoesJson) ?? [])
        .GroupBy(r => r.CodRemedio)
        .ToDictionary(
            g => g.Key,
            g => new DetalheItem(
                g.First().Nome,
                g.First().Descricao ?? string.Empty,
                g.First().Img,
                g.First().ImgFormat ?? "png"));

    private static IReadOnlyDictionary<int, DetalheItem> LerAkumas(string conteudo)
    {
        var yaml = new DeserializerBuilder()
            .WithNamingConvention(UnderscoredNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();

        return (yaml.Deserialize<List<AkumaYaml>>(conteudo) ?? [])
            .Where(a => a is not null)
            .GroupBy(a => a.CodAkuma)
            .ToDictionary(
                g => g.Key,
                g => new DetalheItem(
                    g.First().Nome,
                    g.First().Descricao ?? string.Empty,
                    g.First().Img,
                    g.First().ImgFormat ?? "png"));
    }

    private sealed class ComidaJson
    {
        [JsonPropertyName("cod_comida")]
        public int CodComida { get; set; }

        public string Nome { get; set; } = string.Empty;

        public string? Descricao { get; set; }

        public int Img { get; set; }
    }

    private sealed class RemedioJson
    {
        [JsonPropertyName("cod_remedio")]
        public int CodRemedio { get; set; }

        public string Nome { get; set; } = string.Empty;

        public string? Descricao { get; set; }

        public int Img { get; set; }

        [JsonPropertyName("img_format")]
        public string? ImgFormat { get; set; }
    }

    private sealed class AkumaYaml
    {
        public int CodAkuma { get; set; }

        public string Nome { get; set; } = string.Empty;

        public string? Descricao { get; set; }

        public int Img { get; set; }

        public string? ImgFormat { get; set; }
    }
}

/// <summary>
/// Onde a aplicação está instalada. Existe para o catálogo achar a pasta
/// public/Data sem que a Infrastructure precise conhecer o ASP.NET Core.
/// </summary>
public interface IHostAmbiente
{
    string RaizDoConteudo { get; }
}
