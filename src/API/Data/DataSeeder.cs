using RetroGameTracker.Data;
using RetroGameTracker.Models;

namespace RetroGameTracker.Data;

public static class DataSeeder
{
    public static void Seed(AppDbContext db)
    {
        if (db.Lots.Any()) return; // Ya tiene datos

        // Ejemplo del enunciado: Lote DSi + Juego
        var lot1 = new Lot
        {
            Name = "Lote DSi + Juego",
            Notes = "Comprado en Wallapop",
            PurchaseDate = new DateTime(2024, 1, 15),
            TotalPurchasePrice = 100m,  // 70 + 30
            TotalShippingCost = 10m
        };
        db.Lots.Add(lot1);
        db.SaveChanges();

        // Artículos del lote con reparto proporcional
        // DSi = 70/100 = 70% → 70€ precio + 7€ envío
        // Juego = 30/100 = 30% → 30€ precio + 3€ envío
        var dsi = new Item
        {
            LotId = lot1.Id,
            Type = ItemType.Console,
            Name = "Nintendo DSi",
            Platform = "DS",
            Condition = ItemCondition.Used,
            PurchasePrice = 70m,
            ShippingCost = 7m,
            PurchaseDate = new DateTime(2024, 1, 15),
            IsSold = true,
            SalePrice = 120m,
            SaleDate = new DateTime(2024, 2, 3),
            Notes = "Vendida en Wallapop"
        };

        var juego = new Item
        {
            LotId = lot1.Id,
            Type = ItemType.VideoGame,
            Name = "New Super Mario Bros",
            Platform = "DS",
            Condition = ItemCondition.Used,
            PurchasePrice = 30m,
            ShippingCost = 3m,
            PurchaseDate = new DateTime(2024, 1, 15),
            IsSold = false,
            Notes = "En stock"
        };
        db.Items.AddRange(dsi, juego);

        // Lote 2: Switch + 2 juegos
        var lot2 = new Lot
        {
            Name = "Pack Switch Lite + 2 juegos",
            PurchaseDate = new DateTime(2024, 3, 10),
            TotalPurchasePrice = 180m,
            TotalShippingCost = 15m
        };
        db.Lots.Add(lot2);
        db.SaveChanges();

        var switchLite = new Item
        {
            LotId = lot2.Id,
            Type = ItemType.Console,
            Name = "Nintendo Switch Lite",
            Platform = "Switch",
            Condition = ItemCondition.Used,
            PurchasePrice = 130m,
            ShippingCost = 10.83m,
            PurchaseDate = new DateTime(2024, 3, 10),
            IsSold = false
        };
        var zelda = new Item
        {
            LotId = lot2.Id,
            Type = ItemType.VideoGame,
            Name = "The Legend of Zelda: Link's Awakening",
            Platform = "Switch",
            Condition = ItemCondition.Used,
            PurchasePrice = 25m,
            ShippingCost = 2.08m,
            PurchaseDate = new DateTime(2024, 3, 10),
            IsSold = false
        };
        var mario = new Item
        {
            LotId = lot2.Id,
            Type = ItemType.VideoGame,
            Name = "Mario Kart 8 Deluxe",
            Platform = "Switch",
            Condition = ItemCondition.Used,
            PurchasePrice = 25m,
            ShippingCost = 2.08m,
            PurchaseDate = new DateTime(2024, 3, 10),
            IsSold = true,
            SalePrice = 40m,
            SaleDate = new DateTime(2024, 4, 1)
        };
        db.Items.AddRange(switchLite, zelda, mario);

        // Artículo suelto (sin lote)
        var game3ds = new Item
        {
            Type = ItemType.VideoGame,
            Name = "Pokémon X",
            Platform = "3DS",
            Condition = ItemCondition.Used,
            PurchasePrice = 15m,
            ShippingCost = 3.5m,
            PurchaseDate = new DateTime(2024, 4, 20),
            IsSold = true,
            SalePrice = 35m,
            SaleDate = new DateTime(2024, 5, 5)
        };
        db.Items.Add(game3ds);

        // Ajustes iniciales
        var settings = db.AppSettings.First();
        settings.InitialBalance = 500m;
        db.AppSettings.Update(settings);

        db.SaveChanges();
    }
}
