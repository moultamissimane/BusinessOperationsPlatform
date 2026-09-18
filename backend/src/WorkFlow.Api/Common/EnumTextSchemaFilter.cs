using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace WorkFlow.Api.Common;

/// <summary>Documents enums as the strings that actually go over the wire instead of integers.</summary>
public sealed class EnumTextSchemaFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        var type = Nullable.GetUnderlyingType(context.Type) ?? context.Type;
        if (!type.IsEnum) return;

        schema.Type = "string";
        schema.Format = null;
        schema.Enum = EnumText.Names(type).Select(n => (IOpenApiAny)new OpenApiString(n)).ToList();
    }
}
