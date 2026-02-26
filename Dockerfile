# ── Build ──────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY src/API/RetroGameTracker.csproj .
RUN dotnet restore

COPY src/API/ .
RUN dotnet publish -c Release -o /app/publish

# ── Runtime ────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Datos persistentes en volumen
VOLUME ["/app/data"]

COPY --from=build /app/publish .

# Apuntar la base de datos al volumen persistente
ENV ConnectionStrings__DefaultConnection="Data Source=/app/data/retrogame.db"
ENV ASPNETCORE_URLS="http://+:8080"

EXPOSE 8080

ENTRYPOINT ["dotnet", "RetroGameTracker.dll"]
