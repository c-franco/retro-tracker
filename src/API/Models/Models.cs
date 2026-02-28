namespace RetroGameTracker.Models;

/// <summary>
/// Representa un lote de compra (puede contener varios artículos)
/// </summary>
public class Lot
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DateTime PurchaseDate { get; set; } = DateTime.UtcNow;
    public decimal TotalPurchasePrice { get; set; }
    public decimal TotalShippingCost { get; set; }
    public decimal TotalCost => TotalPurchasePrice + TotalShippingCost;

    public ICollection<Item> Items { get; set; } = new List<Item>();
}

/// <summary>
/// Artículo individual (consola, juego o accesorio)
/// </summary>
public class Item
{
    public int Id { get; set; }

    public ItemType Type { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Platform { get; set; }
    public ItemCondition Condition { get; set; }
    public string? Notes { get; set; }

    public int? LotId { get; set; }
    public Lot? Lot { get; set; }

    public decimal PurchasePrice { get; set; }
    public decimal ShippingCost { get; set; }
    public decimal TotalCost => PurchasePrice + ShippingCost;
    public DateTime PurchaseDate { get; set; } = DateTime.UtcNow;

    public bool IsCollection { get; set; } = false;

    public bool IsSold { get; set; } = false;
    public decimal? SalePrice { get; set; }
    public DateTime? SaleDate { get; set; }

    public decimal? Profit => IsSold && SalePrice.HasValue
        ? SalePrice.Value - TotalCost
        : null;

    // Relación con etiquetas
    public ICollection<ItemTag> ItemTags { get; set; } = new List<ItemTag>();
}

/// <summary>
/// Etiqueta libre creada por el usuario (ej: "pendiente limpiar", "regalo")
/// </summary>
public class Tag
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    public ICollection<ItemTag> ItemTags { get; set; } = new List<ItemTag>();
}

/// <summary>
/// Tabla intermedia Item ↔ Tag (muchos a muchos)
/// </summary>
public class ItemTag
{
    public int ItemId { get; set; }
    public Item Item { get; set; } = null!;

    public int TagId { get; set; }
    public Tag Tag { get; set; } = null!;
}

/// <summary>
/// Configuración general de la aplicación
/// </summary>
public class AppSettings
{
    public int Id { get; set; } = 1;
    public decimal InitialBalance { get; set; } = 0;
    public string Currency { get; set; } = "EUR";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum ItemType
{
    Console = 0,
    VideoGame = 1,
    Accessory = 2
}

public enum ItemCondition
{
    New = 0,
    Used = 1,
    NeedsRepair = 2
}
