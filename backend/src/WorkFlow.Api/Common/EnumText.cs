using System.Collections.Concurrent;
using System.Reflection;
using System.Runtime.Serialization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace WorkFlow.Api.Common;

/// <summary>
/// Converts enums to and from the display strings the frontend uses ("In Progress", "Annual leave"),
/// taken from [EnumMember]. Falls back to the member name.
/// </summary>
public static class EnumText
{
    private sealed record Map(Dictionary<object, string> ToText, Dictionary<string, object> FromText);

    private static readonly ConcurrentDictionary<Type, Map> Maps = new();

    private static Map For(Type type) => Maps.GetOrAdd(type, static t =>
    {
        var toText = new Dictionary<object, string>();
        var fromText = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        foreach (var field in t.GetFields(BindingFlags.Public | BindingFlags.Static))
        {
            var value = field.GetValue(null)!;
            var text = field.GetCustomAttribute<EnumMemberAttribute>()?.Value ?? field.Name;
            toText[value] = text;
            fromText[text] = value;
            fromText.TryAdd(field.Name, value);
        }
        return new Map(toText, fromText);
    });

    public static string ToText(this Enum value) => For(value.GetType()).ToText[value];

    public static IReadOnlyCollection<string> Names(Type enumType) => For(enumType).ToText.Values;

    public static bool TryParse<T>(string? text, out T value) where T : struct, Enum
    {
        if (text is not null && For(typeof(T)).FromText.TryGetValue(text.Trim(), out var boxed))
        {
            value = (T)boxed;
            return true;
        }
        value = default;
        return false;
    }
}

public sealed class EnumTextConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert) => typeToConvert.IsEnum;

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options) =>
        (JsonConverter)Activator.CreateInstance(typeof(Converter<>).MakeGenericType(typeToConvert))!;

    private sealed class Converter<T> : JsonConverter<T> where T : struct, Enum
    {
        public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.String && EnumText.TryParse<T>(reader.GetString(), out var value))
                return value;

            throw new JsonException($"Invalid value for {typeof(T).Name}. Allowed: {string.Join(", ", EnumText.Names(typeof(T)))}.");
        }

        public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options) =>
            writer.WriteStringValue(value.ToText());
    }
}
