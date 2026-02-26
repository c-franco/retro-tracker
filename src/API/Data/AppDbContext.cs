using Microsoft.EntityFrameworkCore;
using RetroGameTracker.Models;

namespace RetroGameTracker.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Lot> Lots => Set<Lot>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<AppSettings> AppSettings => Set<AppSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Configuración de decimales para SQLite
        modelBuilder.Entity<Item>(e =>
        {
            e.Property(x => x.PurchasePrice).HasColumnType("decimal(18,2)");
            e.Property(x => x.ShippingCost).HasColumnType("decimal(18,2)");
            e.Property(x => x.SalePrice).HasColumnType("decimal(18,2)");
            e.Ignore(x => x.TotalCost);
            e.Ignore(x => x.Profit);
        });

        modelBuilder.Entity<Lot>(e =>
        {
            e.Property(x => x.TotalPurchasePrice).HasColumnType("decimal(18,2)");
            e.Property(x => x.TotalShippingCost).HasColumnType("decimal(18,2)");
            e.Ignore(x => x.TotalCost);
        });

        modelBuilder.Entity<AppSettings>(e =>
        {
            e.Property(x => x.InitialBalance).HasColumnType("decimal(18,2)");
            e.HasData(new AppSettings { Id = 1, InitialBalance = 0, Currency = "EUR" });
        });
    }
}
