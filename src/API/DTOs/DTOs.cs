namespace RetroGameTracker.DTOs;

// ───── ITEMS ─────

public record ItemDto(
    int Id,
    string Type,
    string Name,
    string? Platform,
    string Condition,
    int? LotId,
    string? LotName,
    decimal PurchasePrice,
    decimal ShippingCost,
    decimal TotalCost,
    DateTime PurchaseDate,
    bool IsSold,
    decimal? SalePrice,
    DateTime? SaleDate,
    decimal? Profit,
    string? Notes
);

public record CreateItemRequest(
    string Type,          // "Console" | "VideoGame" | "Accessory"
    string Name,
    string? Platform,
    string Condition,     // "New" | "Used" | "NeedsRepair"
    int? LotId,
    decimal PurchasePrice,
    decimal ShippingCost,
    DateTime? PurchaseDate,
    string? Notes
);

public record UpdateItemRequest(
    string? Type,
    string? Name,
    string? Platform,
    string? Condition,
    decimal? PurchasePrice,
    decimal? ShippingCost,
    DateTime? PurchaseDate,
    string? Notes
);

public record SellItemRequest(
    decimal SalePrice,
    DateTime? SaleDate
);

// ───── LOTS ─────

public record LotDto(
    int Id,
    string Name,
    string? Notes,
    DateTime PurchaseDate,
    decimal TotalPurchasePrice,
    decimal TotalShippingCost,
    decimal TotalCost,
    int TotalItems,
    int SoldItems,
    int StockItems,
    decimal TotalRevenue,
    decimal TotalProfit,
    List<ItemDto> Items
);

public record CreateLotRequest(
    string Name,
    string? Notes,
    DateTime? PurchaseDate,
    decimal TotalPurchasePrice,
    decimal TotalShippingCost,
    List<LotItemRequest> Items  // Artículos con su precio proporcional
);

public record LotItemRequest(
    string Type,
    string Name,
    string? Platform,
    string Condition,
    decimal PurchasePrice,   // Ya calculado por el usuario o automático
    decimal ShippingCost,
    string? Notes
);

// ───── DASHBOARD ─────

public record DashboardDto(
    decimal InitialBalance,
    decimal TotalInvested,       // Suma de todos los costes de compra
    decimal TotalRevenue,        // Suma de todas las ventas
    decimal TotalProfit,         // Revenue - Invested
    decimal CurrentBalance,      // InitialBalance + Profit
    bool IsPositive,
    decimal StockValue,          // Valor en stock (precio compra de artículos no vendidos)
    int TotalItems,
    int SoldItems,
    int StockItems,
    List<MonthlyStatsDto> MonthlyStats,
    List<ItemDto> PendingItems,
    List<PlatformStatsDto> PlatformStats
);

public record MonthlyStatsDto(
    int Year,
    int Month,
    string MonthName,
    decimal Invested,
    decimal Revenue,
    decimal Profit
);

public record PlatformStatsDto(
    string Platform,
    int TotalItems,
    int SoldItems,
    decimal TotalRevenue,
    decimal TotalProfit
);

// ───── SETTINGS ─────

public record SettingsDto(
    decimal InitialBalance,
    string Currency
);

public record UpdateSettingsRequest(
    decimal InitialBalance,
    string Currency
);
