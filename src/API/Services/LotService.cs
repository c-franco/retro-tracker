using Microsoft.EntityFrameworkCore;
using RetroGameTracker.Data;
using RetroGameTracker.DTOs;
using RetroGameTracker.Models;

namespace RetroGameTracker.Services;

public class LotService
{
    private readonly AppDbContext _db;

    public LotService(AppDbContext db) => _db = db;

    public static LotDto ToDto(Lot lot)
    {
        var items = lot.Items.ToList();
        var soldItems = items.Where(i => i.IsSold).ToList();

        return new LotDto(
            lot.Id,
            lot.Name,
            lot.Notes,
            lot.PurchaseDate,
            lot.TotalPurchasePrice,
            lot.TotalShippingCost,
            lot.TotalCost,
            items.Count,
            soldItems.Count,
            items.Count(i => !i.IsSold),
            soldItems.Sum(i => i.SalePrice ?? 0),
            soldItems.Sum(i => i.Profit ?? 0),
            items.Select(ItemService.ToDto).ToList()
        );
    }

    public async Task<List<LotDto>> GetAllAsync()
    {
        var lots = await _db.Lots
            .Include(l => l.Items)
            .OrderByDescending(l => l.PurchaseDate)
            .ToListAsync();
        return lots.Select(ToDto).ToList();
    }

    public async Task<LotDto?> GetByIdAsync(int id)
    {
        var lot = await _db.Lots.Include(l => l.Items).FirstOrDefaultAsync(l => l.Id == id);
        return lot == null ? null : ToDto(lot);
    }

    /// <summary>
    /// Crea un lote con sus artículos. El precio/envío de cada artículo
    /// ya viene especificado (el usuario define el reparto proporcional o manual).
    /// </summary>
    public async Task<LotDto> CreateAsync(CreateLotRequest req)
    {
        var lot = new Lot
        {
            Name = req.Name,
            Notes = req.Notes,
            PurchaseDate = req.PurchaseDate ?? DateTime.UtcNow,
            TotalPurchasePrice = req.TotalPurchasePrice,
            TotalShippingCost = req.TotalShippingCost
        };
        _db.Lots.Add(lot);
        await _db.SaveChangesAsync();

        // Si no se especifican precios individuales, reparto proporcional automático
        decimal totalItemPrice = req.Items.Sum(i => i.PurchasePrice);
        bool autoDivide = totalItemPrice == 0 && req.Items.Any();

        foreach (var ri in req.Items)
        {
            decimal purchasePrice = ri.PurchasePrice;
            decimal shippingCost = ri.ShippingCost;

            if (autoDivide)
            {
                // Reparto equitativo
                purchasePrice = Math.Round(req.TotalPurchasePrice / req.Items.Count, 2);
                shippingCost = Math.Round(req.TotalShippingCost / req.Items.Count, 2);
            }

            var item = new Item
            {
                LotId = lot.Id,
                Type = Enum.Parse<ItemType>(ri.Type, true),
                Name = ri.Name,
                Platform = ri.Platform,
                Condition = Enum.Parse<ItemCondition>(ri.Condition, true),
                PurchasePrice = purchasePrice,
                ShippingCost = shippingCost,
                PurchaseDate = lot.PurchaseDate,
                Notes = ri.Notes
            };
            _db.Items.Add(item);
        }

        await _db.SaveChangesAsync();

        // Recargar con items
        var created = await _db.Lots.Include(l => l.Items).FirstAsync(l => l.Id == lot.Id);
        return ToDto(created);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var lot = await _db.Lots.Include(l => l.Items).FirstOrDefaultAsync(l => l.Id == id);
        if (lot == null) return false;

        // Solo borra si todos los artículos están en stock (no vendidos)
        if (lot.Items.Any(i => i.IsSold))
            throw new InvalidOperationException("No se puede borrar un lote con artículos vendidos.");

        _db.Items.RemoveRange(lot.Items);
        _db.Lots.Remove(lot);
        await _db.SaveChangesAsync();
        return true;
    }
}
