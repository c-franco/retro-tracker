using Microsoft.EntityFrameworkCore;
using RetroGameTracker.Data;
using RetroGameTracker.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Servicios ──────────────────────────────────────────────

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Retro Tracker API", Version = "v1" });
});

// Base de datos SQLite
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Data Source=retrogame.db"));

// Servicios de negocio
builder.Services.AddScoped<ItemService>();
builder.Services.AddScoped<LotService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<ExportService>();

// CORS para el frontend
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(p => p
        .AllowAnyOrigin()
        .AllowAnyMethod()
        .AllowAnyHeader()));

var app = builder.Build();

// ── Middleware ─────────────────────────────────────────────

app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Servir el frontend estático (wwwroot)
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthorization();
app.MapControllers();

// Fallback para SPA
app.MapFallbackToFile("index.html");

// ── Migración y seed automáticos ──────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    DataSeeder.Seed(db);
}

app.Run();
