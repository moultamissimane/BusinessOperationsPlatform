# ---- build ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore first so this layer is cached until a csproj changes.
COPY src/WorkFlow.Api/WorkFlow.Api.csproj src/WorkFlow.Api/
RUN dotnet restore src/WorkFlow.Api/WorkFlow.Api.csproj

COPY src/ src/
RUN dotnet publish src/WorkFlow.Api/WorkFlow.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false

# ---- runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Receipts land here; mount a volume (or swap IReceiptStorage for Azure Blob) so they outlive the container.
RUN mkdir -p /app/data/receipts && chown -R app:app /app/data
COPY --from=build /app .

USER app
ENV ASPNETCORE_HTTP_PORTS=8080 \
    Storage__ReceiptsPath=/app/data/receipts
EXPOSE 8080

ENTRYPOINT ["dotnet", "WorkFlow.Api.dll"]
