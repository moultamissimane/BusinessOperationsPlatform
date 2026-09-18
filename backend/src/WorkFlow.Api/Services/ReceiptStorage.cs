using Azure;
using Azure.Identity;
using Azure.Storage.Blobs;
using Microsoft.Extensions.Options;

namespace WorkFlow.Api.Services;

public interface IReceiptStorage
{
    Task<string> SaveAsync(Guid expenseId, string extension, Stream content, CancellationToken ct);
    /// <summary>Null when the receipt no longer exists.</summary>
    Task<Stream?> OpenAsync(string key, CancellationToken ct);
    Task DeleteAsync(string key, CancellationToken ct);
}

public class StorageOptions
{
    /// <summary>"Local" (disk, for development) or "AzureBlob" (production).</summary>
    public string Provider { get; set; } = "Local";
    public string ReceiptsPath { get; set; } = "data/receipts";
    public AzureBlobOptions AzureBlob { get; set; } = new();
}

public class AzureBlobOptions
{
    /// <summary>e.g. https://myaccount.blob.core.windows.net — authenticated with the app's managed identity.</summary>
    public string ServiceUri { get; set; } = "";
    /// <summary>Only for local emulators such as Azurite; takes precedence over ServiceUri.</summary>
    public string ConnectionString { get; set; } = "";
    public string Container { get; set; } = "receipts";
}

// The key is always generated server-side; a client-supplied file name never reaches storage.
internal static class ReceiptKey
{
    public static string For(Guid expenseId, string extension) => $"{expenseId:N}-{Guid.NewGuid():N}{extension}";
}

public sealed class LocalReceiptStorage : IReceiptStorage
{
    private readonly string _root;

    public LocalReceiptStorage(IOptions<StorageOptions> options)
    {
        _root = Path.GetFullPath(options.Value.ReceiptsPath);
        Directory.CreateDirectory(_root);
    }

    public async Task<string> SaveAsync(Guid expenseId, string extension, Stream content, CancellationToken ct)
    {
        var key = ReceiptKey.For(expenseId, extension);
        await using var file = File.Create(Resolve(key));
        await content.CopyToAsync(file, ct);
        return key;
    }

    public Task<Stream?> OpenAsync(string key, CancellationToken ct)
    {
        var path = Resolve(key);
        return Task.FromResult<Stream?>(File.Exists(path) ? File.OpenRead(path) : null);
    }

    public Task DeleteAsync(string key, CancellationToken ct)
    {
        var path = Resolve(key);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    private string Resolve(string key)
    {
        var path = Path.GetFullPath(Path.Combine(_root, key));
        if (!path.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            throw new InvalidOperationException("Invalid receipt key.");
        return path;
    }
}

public sealed class AzureBlobReceiptStorage : IReceiptStorage
{
    private readonly BlobContainerClient _container;
    private readonly SemaphoreSlim _init = new(1, 1);
    private bool _ready;

    public AzureBlobReceiptStorage(IOptions<StorageOptions> options)
    {
        var o = options.Value.AzureBlob;
        _container = !string.IsNullOrEmpty(o.ConnectionString)
            ? new BlobContainerClient(o.ConnectionString, o.Container)
            : !string.IsNullOrEmpty(o.ServiceUri)
                ? new BlobContainerClient(new Uri($"{o.ServiceUri.TrimEnd('/')}/{o.Container}"), new DefaultAzureCredential())
                : throw new InvalidOperationException("Storage:AzureBlob needs either ServiceUri or ConnectionString.");
    }

    public async Task<string> SaveAsync(Guid expenseId, string extension, Stream content, CancellationToken ct)
    {
        await EnsureContainerAsync(ct);
        var key = ReceiptKey.For(expenseId, extension);
        await _container.GetBlobClient(key).UploadAsync(content, overwrite: false, ct);
        return key;
    }

    public async Task<Stream?> OpenAsync(string key, CancellationToken ct)
    {
        try
        {
            return await _container.GetBlobClient(key).OpenReadAsync(cancellationToken: ct);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    public async Task DeleteAsync(string key, CancellationToken ct) =>
        await _container.GetBlobClient(key).DeleteIfExistsAsync(cancellationToken: ct);

    // In Azure the container is created by infrastructure code and the identity may lack permission to create it,
    // so failure here is tolerated: a missing container will surface on the upload itself.
    private async Task EnsureContainerAsync(CancellationToken ct)
    {
        if (_ready) return;
        await _init.WaitAsync(ct);
        try
        {
            if (_ready) return;
            try { await _container.CreateIfNotExistsAsync(cancellationToken: ct); }
            catch (RequestFailedException ex) when (ex.Status is 403 or 409) { }
            _ready = true;
        }
        finally { _init.Release(); }
    }
}
