using Microsoft.EntityFrameworkCore;
using RetroGameTracker.Data;
using RetroGameTracker.DTOs;

namespace RetroGameTracker.Services;

public class DashboardService
{
    private readonly AppDbContext _db;

    public DashboardService(AppDbContext db) => _db = db;

    public async Task<DashboardDto> GetDashboardAsync()
    {
        var settings = await _db.AppSettings.FirstAsync();
        var items = await _db.Items.Include(i => i.Lot).ToListAsync();

        var sold = items.Where(i => i.IsSold).ToList();
        var stock = items.Where(i => !i.IsSold).ToList();

        decimal totalInvested = items.Sum(i => i.TotalCost);
        decimal totalRevenue = sold.Sum(i => i.SalePrice ?? 0);
        decimal totalProfit = totalRevenue - totalInvested;
        decimal currentBalance = settings.InitialBalance + totalProfit;
        decimal stockValue = stock.Sum(i => i.TotalCost);

        // Estadísticas mensuales (últimos 12 meses)
        var monthlyStats = items
            .GroupBy(i => new { i.PurchaseDate.Year, i.PurchaseDate.Month })
            .Select(g => new MonthlyStatsDto(
                g.Key.Year,
                g.Key.Month,
                new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMMM"),
                g.Sum(i => i.TotalCost),
                g.Where(i => i.IsSold).Sum(i => i.SalePrice ?? 0),
                g.Where(i => i.IsSold).Sum(i => i.Profit ?? 0)
            ))
            .OrderBy(m => m.Year).ThenBy(m => m.Month)
            .TakeLast(12)
            .ToList();

        // Stats por plataforma
        var platformStats = items
            .Where(i => i.Platform != null)
            .GroupBy(i => i.Platform!)
            .Select(g => new PlatformStatsDto(
                g.Key,
                g.Count(),
                g.Count(i => i.IsSold),
                g.Where(i => i.IsSold).Sum(i => i.SalePrice ?? 0),
                g.Where(i => i.IsSold).Sum(i => i.Profit ?? 0)
            ))
            .OrderByDescending(p => p.TotalItems)
            .ToList();

        // Artículos pendientes de vender
        var pendingItems = stock
            .OrderBy(i => i.PurchaseDate)
            .Select(ItemService.ToDto)
            .ToList();

        return new DashboardDto(
            settings.InitialBalance,
            Math.Round(totalInvested, 2),
            Math.Round(totalRevenue, 2),
            Math.Round(totalProfit, 2),
            Math.Round(currentBalance, 2),
            currentBalance >= 0,
            Math.Round(stockValue, 2),
            items.Count,
            sold.Count,
            stock.Count,
            monthlyStats,
            pendingItems,
            platformStats
        );
    }
}
