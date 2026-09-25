using SugoiGame.Infrastructure.Catalogos;

namespace SugoiGame.Api;

/// <summary>
/// Liga o <see cref="IHostAmbiente"/> da Infrastructure ao ambiente do ASP.NET
/// Core. Existe para a camada de infraestrutura localizar os catálogos em
/// public/Data sem depender do host web.
/// </summary>
public class HostAmbiente(IWebHostEnvironment ambiente) : IHostAmbiente
{
    public string RaizDoConteudo => ambiente.ContentRootPath;
}
