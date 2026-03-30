using Microsoft.EntityFrameworkCore;
using RetroGameTracker.Data;
using RetroGameTracker.DTOs;
using RetroGameTracker.Models;
using RetroGameTracker.Resources;

namespace RetroGameTracker.Services;

public class LotService
{
    private readonly AppDbContext _db;

    public LotService(AppDbContext db) => _db = db;

    // ── Mapeo Lot → LotDto ──────────────────────────────────────────────

    public static LotDto ToDto(Lot lot)
    {
        var items     = lot.Items.ToList();
        var soldItems = items.Where(i => i.IsSold).ToList();

        var realPurchasePrice = items.Sum(i => i.PurchasePrice);
        var realShippingCost  = items.Sum(i => i.ShippingCost);
        var realTotalCost     = realPurchasePrice + realShippingCost;

        return new LotDto(
            lot.Id,
            lot.Code,
            lot.Name,
            lot.Notes,
            lot.PurchaseDate,
            realPurchasePrice,
            realShippingCost,
            realTotalCost,
            items.Count,
            soldItems.Count,
            items.Count(i => !i.IsSold),
            soldItems.Sum(i => i.SalePrice ?? 0),
            soldItems.Sum(i => i.Profit ?? 0),
            items.Select(ItemService.ToDto).ToList()
        );
    }

    // ── Generar código único LOT-001, LOT-002… ──────────────────────────

    private async Task<string> GenerateCodeAsync()
    {
        // Obtener todos los códigos existentes con formato LOT-NNN
        var existingNumbers = await _db.Lots
            .Where(l => l.Code.StartsWith("LOT-"))
            .Select(l => l.Code)
            .ToListAsync();

        var usedNumbers = existingNumbers
            .Select(c => { int n; return int.TryParse(c.Replace(AppText.Get("backend.import.lotPrefix"), ""), out n) ? n : 0; })
            .Where(n => n > 0)
            .ToHashSet();

        // Buscar el primer número libre
        int next = 1;
        while (usedNumbers.Contains(next)) next++;

        return $"{AppText.Get("backend.import.lotPrefix")}{next:D3}";
    }

    // ── Queries ─────────────────────────────────────────────────────────

    public async Task<List<LotDto>> GetAllAsync()
    {
        var lots = await _db.Lots
            .Include(l => l.Items).ThenInclude(i => i.ItemTags).ThenInclude(it => it.Tag)
            .OrderByDescending(l => l.PurchaseDate)
            .ToListAsync();
        return lots.Select(ToDto).ToList();
    }

    public async Task<LotDto?> GetByIdAsync(int id)
    {
        var lot = await _db.Lots
            .Include(l => l.Items).ThenInclude(i => i.ItemTags).ThenInclude(it => it.Tag)
            .FirstOrDefaultAsync(l => l.Id == id);
        return lot == null ? null : ToDto(lot);
    }

    // ── Crear lote ───────────────────────────────────────────────────────

    public async Task<LotDto> CreateAsync(CreateLotRequest req)
    {
        var code = await GenerateCodeAsync();

        var lot = new Lot
        {
            Code               = code,
            Name               = req.Name,
            Notes              = req.Notes,
            PurchaseDate       = req.PurchaseDate ?? DateTime.UtcNow,
            TotalPurchasePrice = req.TotalPurchasePrice,
            TotalShippingCost  = req.TotalShippingCost
        };
        _db.Lots.Add(lot);
        await _db.SaveChangesAsync();

        decimal totalItemPrice = req.Items.Sum(i => i.PurchasePrice);
        bool autoDivide = totalItemPrice == 0 && req.Items.Any();

        foreach (var ri in req.Items)
        {
            decimal purchasePrice = ri.PurchasePrice;
            decimal shippingCost  = ri.ShippingCost;

            if (autoDivide)
            {
                purchasePrice = Math.Round(req.TotalPurchasePrice / req.Items.Count, 2);
                shippingCost  = Math.Round(req.TotalShippingCost  / req.Items.Count, 2);
            }

            var item = new Item
            {
                LotId         = lot.Id,
                Type          = Enum.Parse<ItemType>(ri.Type, true),
                Name          = ri.Name,
                Platform      = ri.Platform,
                Condition     = Enum.Parse<ItemCondition>(ri.Condition, true),
                PurchasePrice = purchasePrice,
                ShippingCost  = shippingCost,
                PurchaseDate  = lot.PurchaseDate,
                Notes         = ri.Notes
            };
            _db.Items.Add(item);
        }

        await _db.SaveChangesAsync();

        var created = await _db.Lots
            .Include(l => l.Items).ThenInclude(i => i.ItemTags).ThenInclude(it => it.Tag)
            .FirstAsync(l => l.Id == lot.Id);
        return ToDto(created);
    }

    // ── Añadir artículos a lote existente ───────────────────────────────

    public async Task<LotDto?> AddItemsAsync(int lotId, AddItemsToLotRequest req)
    {
        var lot = await _db.Lots
            .Include(l => l.Items)
            .FirstOrDefaultAsync(l => l.Id == lotId);
        if (lot == null) return null;

        foreach (var ri in req.Items)
        {
            var item = new Item
            {
                LotId         = lot.Id,
                Type          = Enum.Parse<ItemType>(ri.Type, true),
                Name          = ri.Name,
                Platform      = ri.Platform,
                Condition     = Enum.Parse<ItemCondition>(ri.Condition, true),
                PurchasePrice = ri.PurchasePrice,
                ShippingCost  = ri.ShippingCost,
                PurchaseDate  = lot.PurchaseDate,
                Notes         = ri.Notes
            };
            _db.Items.Add(item);
        }

        await _db.SaveChangesAsync();

        var updated = await _db.Lots
            .Include(l => l.Items).ThenInclude(i => i.ItemTags).ThenInclude(it => it.Tag)
            .FirstAsync(l => l.Id == lotId);
        return ToDto(updated);
    }

    // ── Actualizar lote ─────────────────────────────────────────────────

    public async Task<LotDto?> UpdateAsync(int id, UpdateLotRequest req)
    {
        var lot = await _db.Lots.Include(l => l.Items).FirstOrDefaultAsync(l => l.Id == id);
        if (lot == null) return null;

        lot.Name  = req.Name;
        lot.Notes = req.Notes;

        if (req.PurchaseDate.HasValue && req.PurchaseDate.Value != lot.PurchaseDate)
        {
            lot.PurchaseDate = req.PurchaseDate.Value;
            foreach (var item in lot.Items)
                item.PurchaseDate = req.PurchaseDate.Value;
        }

        await _db.SaveChangesAsync();

        var updated = await _db.Lots
            .Include(l => l.Items).ThenInclude(i => i.ItemTags).ThenInclude(it => it.Tag)
            .FirstAsync(l => l.Id == id);
        return ToDto(updated);
    }

    // ── Eliminar lote ───────────────────────────────────────────────────

    public async Task<bool> DeleteAsync(int id)
    {
        var lot = await _db.Lots.Include(l => l.Items).FirstOrDefaultAsync(l => l.Id == id);
        if (lot == null) return false;

        if (lot.Items.Any(i => i.IsSold))
            throw new InvalidOperationException(AppText.Get("backend.lots.deleteWithSoldItems"));

        _db.Items.RemoveRange(lot.Items);
        _db.Lots.Remove(lot);
        await _db.SaveChangesAsync();
        return true;
    }
}
