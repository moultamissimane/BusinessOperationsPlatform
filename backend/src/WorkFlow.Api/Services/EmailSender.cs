using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace WorkFlow.Api.Services;

public class EmailOptions
{
    public string From { get; set; } = "no-reply@workflow-erp.ma";
    public SmtpOptions Smtp { get; set; } = new();
}

public class SmtpOptions
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public string User { get; set; } = "";
    public string Password { get; set; } = "";
    public bool UseSsl { get; set; } = true;
}

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body, CancellationToken ct);
}

public sealed class SmtpEmailSender(IOptions<EmailOptions> options) : IEmailSender
{
    public async Task SendAsync(string to, string subject, string body, CancellationToken ct)
    {
        var o = options.Value;
        using var client = new SmtpClient(o.Smtp.Host, o.Smtp.Port) { EnableSsl = o.Smtp.UseSsl };
        if (!string.IsNullOrEmpty(o.Smtp.User)) client.Credentials = new NetworkCredential(o.Smtp.User, o.Smtp.Password);
        using var message = new MailMessage(o.From, to, subject, body);
        await client.SendMailAsync(message, ct);
    }
}

/// <summary>Used when no SMTP host is configured. Deliberately never logs the body: it contains a live reset link.</summary>
public sealed class UnconfiguredEmailSender(ILogger<UnconfiguredEmailSender> logger) : IEmailSender
{
    public Task SendAsync(string to, string subject, string body, CancellationToken ct)
    {
        logger.LogWarning("Email to {Recipient} ('{Subject}') was not sent: Email:Smtp:Host is not configured.", to, subject);
        return Task.CompletedTask;
    }
}
