using Microsoft.Extensions.Options;
using WorkFlow.Api.Services;

namespace WorkFlow.Api.Tests;

/// <summary>
/// Runs only when WORKFLOW_TEST_AZURITE holds an Azurite (Azure Storage emulator) connection string; otherwise it exits early.
///   docker run -p 10000:10000 mcr.microsoft.com/azure-storage/azurite azurite-blob --blobHost 0.0.0.0
/// </summary>
public class BlobStorageTests
{
    [Fact]
    public async Task Receipts_round_trip_through_blob_storage()
    {
        var connectionString = Environment.GetEnvironmentVariable("WORKFLOW_TEST_AZURITE");
        if (string.IsNullOrEmpty(connectionString)) return;

        var storage = new AzureBlobReceiptStorage(Options.Create(new StorageOptions
        {
            Provider = "AzureBlob",
            AzureBlob = new AzureBlobOptions { ConnectionString = connectionString, Container = $"receipts-{Guid.NewGuid():N}" },
        }));

        var expenseId = Guid.NewGuid();
        var key = await storage.SaveAsync(expenseId, ".png", new MemoryStream(TestData.Png), CancellationToken.None);
        Assert.StartsWith(expenseId.ToString("N"), key);

        await using (var stream = await storage.OpenAsync(key, CancellationToken.None))
        {
            Assert.NotNull(stream);
            var copy = new MemoryStream();
            await stream!.CopyToAsync(copy);
            Assert.Equal(TestData.Png, copy.ToArray());
        }

        await storage.DeleteAsync(key, CancellationToken.None);
        Assert.Null(await storage.OpenAsync(key, CancellationToken.None));
        await storage.DeleteAsync(key, CancellationToken.None); // deleting twice is harmless
    }
}
