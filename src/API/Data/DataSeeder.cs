using RetroGameTracker.Data;
using RetroGameTracker.Models;

namespace RetroGameTracker.Data;

public static class DataSeeder
{
    public static void Seed(AppDbContext db)
    {
        if (db.Lots.Any()) return; // Ya tiene datos

        // ─────────────────────────────────────────────────────────
        // LOTE 1: Lote 3DS XL Pikachu
        // Fecha: 04/03/26 — Wallapop — Invertido: 115,48 €
        // ─────────────────────────────────────────────────────────
        var lot1 = new Lot
        {
            Name = "Lote 3DS XL Pikachu",
            Notes = "Wallapop",
            PurchaseDate = new DateTime(2026, 3, 4),
            TotalPurchasePrice = 115.48m,
            TotalShippingCost = 0m
        };
        db.Lots.Add(lot1);
        db.SaveChanges();

        db.Items.AddRange(
            new Item
            {
                LotId = lot1.Id,
                Type = ItemType.Console,
                Name = "Nintendo 3DS XL Edición Pikachu + Cargador + Funda",
                Platform = "3DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 106.48m,
                ShippingCost = 0m,
                PurchaseDate = lot1.PurchaseDate,
                IsSold = false,
                IsCollection = false
            },
            new Item
            {
                LotId = lot1.Id,
                Type = ItemType.VideoGame,
                Name = "LEGO Jurassic World",
                Platform = "3DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 1.00m,
                ShippingCost = 0m,
                PurchaseDate = lot1.PurchaseDate,
                IsSold = false,
                IsCollection = false
            },
            new Item
            {
                LotId = lot1.Id,
                Type = ItemType.VideoGame,
                Name = "New Super Mario Bros. 2",
                Platform = "3DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 3.00m,
                ShippingCost = 0m,
                PurchaseDate = lot1.PurchaseDate,
                IsSold = false,
                IsCollection = false
            },
            new Item
            {
                LotId = lot1.Id,
                Type = ItemType.VideoGame,
                Name = "Star Fox 64 3D",
                Platform = "3DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 1.00m,
                ShippingCost = 0m,
                PurchaseDate = lot1.PurchaseDate,
                IsSold = false,
                IsCollection = false
            },
            new Item
            {
                LotId = lot1.Id,
                Type = ItemType.VideoGame,
                Name = "Mario Kart 7",
                Platform = "3DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 2.00m,
                ShippingCost = 0m,
                PurchaseDate = lot1.PurchaseDate,
                IsSold = false,
                IsCollection = false
            },
            new Item
            {
                LotId = lot1.Id,
                Type = ItemType.VideoGame,
                Name = "Yo-kai Watch",
                Platform = "3DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 1.00m,
                ShippingCost = 0m,
                PurchaseDate = lot1.PurchaseDate,
                IsSold = false,
                IsCollection = false
            },
            new Item
            {
                LotId = lot1.Id,
                Type = ItemType.VideoGame,
                Name = "Yo-kai Watch 2",
                Platform = "3DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 1.00m,
                ShippingCost = 0m,
                PurchaseDate = lot1.PurchaseDate,
                IsSold = false,
                IsCollection = false
            }
        );
        db.SaveChanges();

        // ─────────────────────────────────────────────────────────
        // LOTE 2: Lote DSi + 2 juegos
        // Fecha: 02/03/26 — Wallapop — Invertido: 39,93 €
        // ─────────────────────────────────────────────────────────
        var lot2 = new Lot
        {
            Name = "Lote DSi + 2 juegos",
            Notes = "Wallapop",
            PurchaseDate = new DateTime(2026, 3, 2),
            TotalPurchasePrice = 39.93m,
            TotalShippingCost = 0m
        };
        db.Lots.Add(lot2);
        db.SaveChanges();

        db.Items.AddRange(
            new Item
            {
                LotId = lot2.Id,
                Type = ItemType.Console,
                Name = "Nintendo DSi Negro + Cargador",
                Platform = "DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 37.93m,
                ShippingCost = 0m,
                PurchaseDate = lot2.PurchaseDate,
                IsSold = false,
                IsCollection = false
            },
            new Item
            {
                LotId = lot2.Id,
                Type = ItemType.VideoGame,
                Name = "Call of Duty: Black Ops",
                Platform = "DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 1.00m,
                ShippingCost = 0m,
                PurchaseDate = lot2.PurchaseDate,
                IsSold = false,
                IsCollection = false
            },
            new Item
            {
                LotId = lot2.Id,
                Type = ItemType.VideoGame,
                Name = "New Style Boutique",
                Platform = "3DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 1.00m,
                ShippingCost = 0m,
                PurchaseDate = lot2.PurchaseDate,
                IsSold = false,
                IsCollection = false
            }
        );
        db.SaveChanges();

        // ─────────────────────────────────────────────────────────
        // LOTE 3: Lote Nintendo 3DS XL
        // Fecha: 24/02/26 — Wallapop + Aliexpress — Invertido: 116,00 €
        // ─────────────────────────────────────────────────────────
        var lot3 = new Lot
        {
            Name = "Lote Nintendo 3DS XL",
            Notes = "Wallapop + Aliexpress",
            PurchaseDate = new DateTime(2026, 2, 24),
            TotalPurchasePrice = 116.00m,
            TotalShippingCost = 0m
        };
        db.Lots.Add(lot3);
        db.SaveChanges();

        db.Items.AddRange(
            new Item
            {
                LotId = lot3.Id,
                Type = ItemType.Console,
                Name = "Nintendo 3DS XL Azul/Negro",
                Platform = "3DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 110.74m,
                ShippingCost = 0m,
                PurchaseDate = lot3.PurchaseDate,
                IsSold = false,
                IsCollection = false
            },
            new Item
            {
                LotId = lot3.Id,
                Type = ItemType.Accessory,
                Name = "Cargador 3DS XL",
                Platform = "3DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 0.99m,
                ShippingCost = 0m,
                PurchaseDate = lot3.PurchaseDate,
                IsSold = false,
                IsCollection = false
            },
            new Item
            {
                LotId = lot3.Id,
                Type = ItemType.Accessory,
                Name = "Lápiz 3DS XL",
                Platform = "3DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 0.85m,
                ShippingCost = 0m,
                PurchaseDate = lot3.PurchaseDate,
                IsSold = false,
                IsCollection = false
            },
            new Item
            {
                LotId = lot3.Id,
                Type = ItemType.Accessory,
                Name = "Funda 3DS XL",
                Platform = "3DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 3.42m,
                ShippingCost = 0m,
                PurchaseDate = lot3.PurchaseDate,
                IsSold = false,
                IsCollection = false
            }
        );
        db.SaveChanges();

        // ─────────────────────────────────────────────────────────
        // LOTE 4: Lote DS Lite + juego
        // Fecha: 22/02/26 — Mercadillo — Invertido: 16,00 €
        // ─────────────────────────────────────────────────────────
        var lot4 = new Lot
        {
            Name = "Lote DS Lite + juego",
            Notes = "Mercadillo",
            PurchaseDate = new DateTime(2026, 2, 22),
            TotalPurchasePrice = 16.00m,
            TotalShippingCost = 0m
        };
        db.Lots.Add(lot4);
        db.SaveChanges();

        db.Items.AddRange(
            new Item
            {
                LotId = lot4.Id,
                Type = ItemType.Console,
                Name = "Nintendo DS Lite Negra",
                Platform = "DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 15.00m,
                ShippingCost = 0m,
                PurchaseDate = lot4.PurchaseDate,
                IsSold = false,
                IsCollection = false
            },
            new Item
            {
                LotId = lot4.Id,
                Type = ItemType.VideoGame,
                Name = "Horsez: Mi aventura en el rancho",
                Platform = "DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 1.00m,
                ShippingCost = 0m,
                PurchaseDate = lot4.PurchaseDate,
                IsSold = false,
                IsCollection = false
            }
        );
        db.SaveChanges();

        // ─────────────────────────────────────────────────────────
        // LOTE 5: Lote juegos DS
        // Fecha: 01/01/26 — Juegos DS — Invertido: 0,00 €
        // ─────────────────────────────────────────────────────────
        var lot5 = new Lot
        {
            Name = "Lote juegos DS",
            Notes = "Juegos DS",
            PurchaseDate = new DateTime(2026, 1, 1),
            TotalPurchasePrice = 0m,
            TotalShippingCost = 0m
        };
        db.Lots.Add(lot5);
        db.SaveChanges();

        db.Items.AddRange(
            new Item
            {
                LotId = lot5.Id,
                Type = ItemType.VideoGame,
                Name = "Final Fantasy IV",
                Platform = "DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 0.00m,
                ShippingCost = 0m,
                PurchaseDate = lot5.PurchaseDate,
                IsSold = false,
                IsCollection = false
            },
            new Item
            {
                LotId = lot5.Id,
                Type = ItemType.VideoGame,
                Name = "SmackDown VS Raw WWE 2009",
                Platform = "DS",
                Condition = ItemCondition.Used,
                PurchasePrice = 0.00m,
                ShippingCost = 0m,
                PurchaseDate = lot5.PurchaseDate,
                IsSold = false,
                IsCollection = false
            }
        );
        db.SaveChanges();

        // ─────────────────────────────────────────────────────────
        // Ajustes iniciales
        // ─────────────────────────────────────────────────────────
        var settings = db.AppSettings.First();
        settings.InitialBalance = 0m;
        settings.Currency = "EUR";
        db.AppSettings.Update(settings);
        db.SaveChanges();
    }
}