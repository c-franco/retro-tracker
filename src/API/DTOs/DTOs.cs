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
    string? Notes,
    bool IsCollection,
    List<string> Tags          // ← nuevo
);

public record CreateItemRequest(
    string Type,
    string Name,
    string? Platform,
    string Condition,
    int? LotId,
    decimal PurchasePrice,
    decimal ShippingCost,
    DateTime? PurchaseDate,
    string? Notes,
    bool IsCollection = false,
    List<string>? Tags = null  // ← nuevo
);

public record UpdateItemRequest(
    string? Type,
    string? Name,
    string? Platform,
    string? Condition,
    decimal? PurchasePrice,
    decimal? ShippingCost,
    DateTime? PurchaseDate,
    string? Notes,
    bool? IsCollection,
    List<string>? Tags = null  // ← nuevo
);

public record SellItemRequest(
    decimal SalePrice,
    DateTime? SaleDate
);

// ───── TAGS ─────

public record TagDto(
    int Id,
    string Name,
    int ItemCount
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
    List<LotItemRequest> Items
);

public record LotItemRequest(
    string Type,
    string Name,
    string? Platform,
    string Condition,
    decimal PurchasePrice,
    decimal ShippingCost,
    string? Notes
);

public record UpdateLotRequest(
    string Name,
    string? Notes,
    DateTime? PurchaseDate
);

public record AddItemsToLotRequest(
    List<LotItemRequest> Items
);

// ───── DASHBOARD ─────

public record DashboardDto(
    decimal InitialBalance,
    decimal TotalInvested,
    decimal TotalRevenue,
    decimal TotalProfit,
    decimal CurrentBalance,
    bool IsPositive,
    decimal StockValue,
    decimal CollectionValue,
    int TotalItems,
    int SoldItems,
    int StockItems,
    int CollectionItems,
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
