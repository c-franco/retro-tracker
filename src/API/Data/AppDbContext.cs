using Microsoft.EntityFrameworkCore;
using RetroGameTracker.Models;

namespace RetroGameTracker.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Lot> Lots => Set<Lot>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<ItemTag> ItemTags => Set<ItemTag>();
    public DbSet<AppSettings> AppSettings => Set<AppSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
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

        // Clave primaria compuesta para la tabla intermedia
        modelBuilder.Entity<ItemTag>(e =>
        {
            e.HasKey(x => new { x.ItemId, x.TagId });

            e.HasOne(x => x.Item)
             .WithMany(i => i.ItemTags)
             .HasForeignKey(x => x.ItemId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Tag)
             .WithMany(t => t.ItemTags)
             .HasForeignKey(x => x.TagId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // Nombre de tag único (case-insensitive a nivel de app)
        modelBuilder.Entity<Tag>(e =>
        {
            e.HasIndex(x => x.Name).IsUnique();
        });
    }
}
