namespace RetroGameTracker.Models;

/// <summary>
/// Representa un lote de compra (puede contener varios artículos)
/// </summary>
public class Lot
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;           // Ej: "Lote DSi + Juego"
    public string? Notes { get; set; }
    public DateTime PurchaseDate { get; set; } = DateTime.UtcNow;
    public decimal TotalPurchasePrice { get; set; }            // Precio total pagado por el lote
    public decimal TotalShippingCost { get; set; }             // Envío total del lote
    public decimal TotalCost => TotalPurchasePrice + TotalShippingCost;

    // Relación con artículos
    public ICollection<Item> Items { get; set; } = new List<Item>();
}

/// <summary>
/// Artículo individual (consola, juego o accesorio)
/// </summary>
public class Item
{
    public int Id { get; set; }

    // --- Clasificación ---
    public ItemType Type { get; set; }                         // Consola, Videojuego, Accesorio
    public string Name { get; set; } = string.Empty;          // Ej: "Nintendo DSi"
    public string? Platform { get; set; }                      // Ej: "DS", "3DS", "Switch"
    public ItemCondition Condition { get; set; }               // Nuevo, Usado, Para Reparar
    public string? Notes { get; set; }

    // --- Lote ---
    public int? LotId { get; set; }
    public Lot? Lot { get; set; }

    // --- Compra ---
    /// <summary>Precio de compra asignado a este artículo (parte proporcional del lote)</summary>
    public decimal PurchasePrice { get; set; }
    /// <summary>Gastos de envío asignados a este artículo (parte proporcional del lote)</summary>
    public decimal ShippingCost { get; set; }
    /// <summary>Coste total de adquisición = PurchasePrice + ShippingCost</summary>
    public decimal TotalCost => PurchasePrice + ShippingCost;
    public DateTime PurchaseDate { get; set; } = DateTime.UtcNow;

    // --- Colección personal ---
    /// <summary>True si el artículo se conserva en colección personal (no para venta)</summary>
    public bool IsCollection { get; set; } = false;

    // --- Venta ---
    public bool IsSold { get; set; } = false;
    public decimal? SalePrice { get; set; }
    public DateTime? SaleDate { get; set; }

    // --- Beneficio calculado ---
    /// <summary>Beneficio = Precio Venta - Coste Total (null si no vendido ni colección)</summary>
    public decimal? Profit => IsSold && SalePrice.HasValue
        ? SalePrice.Value - TotalCost
        : null;
}

/// <summary>
/// Configuración general de la aplicación (saldo inicial, etc.)
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
