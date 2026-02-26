using Microsoft.EntityFrameworkCore;
using RetroGameTracker.Data;
using RetroGameTracker.DTOs;
using RetroGameTracker.Models;

namespace RetroGameTracker.Services;

public class ItemService
{
    private readonly AppDbContext _db;

    public ItemService(AppDbContext db) => _db = db;

    // Mapeo Item → ItemDto
    public static ItemDto ToDto(Item item) => new(
        item.Id,
        item.Type.ToString(),
        item.Name,
        item.Platform,
        item.Condition.ToString(),
        item.LotId,
        item.Lot?.Name,
        item.PurchasePrice,
        item.ShippingCost,
        item.TotalCost,
        item.PurchaseDate,
        item.IsSold,
        item.SalePrice,
        item.SaleDate,
        item.Profit,
        item.Notes
    );

    // ─── Consultas ───

    public async Task<List<ItemDto>> GetAllAsync(
        string? platform = null,
        string? type = null,
        string? condition = null,
        bool? isSold = null,
        string? search = null)
    {
        var query = _db.Items.Include(i => i.Lot).AsQueryable();

        if (!string.IsNullOrEmpty(platform))
            query = query.Where(i => i.Platform != null &&
                i.Platform.ToLower() == platform.ToLower());

        if (!string.IsNullOrEmpty(type) && Enum.TryParse<ItemType>(type, true, out var t))
            query = query.Where(i => i.Type == t);

        if (!string.IsNullOrEmpty(condition) && Enum.TryParse<ItemCondition>(condition, true, out var c))
            query = query.Where(i => i.Condition == c);

        if (isSold.HasValue)
            query = query.Where(i => i.IsSold == isSold.Value);

        if (!string.IsNullOrEmpty(search))
            query = query.Where(i => i.Name.ToLower().Contains(search.ToLower()));

        var items = await query.OrderByDescending(i => i.PurchaseDate).ToListAsync();
        return items.Select(ToDto).ToList();
    }

    public async Task<ItemDto?> GetByIdAsync(int id)
    {
        var item = await _db.Items.Include(i => i.Lot).FirstOrDefaultAsync(i => i.Id == id);
        return item == null ? null : ToDto(item);
    }

    // ─── Crear artículo suelto ───

    public async Task<ItemDto> CreateAsync(CreateItemRequest req)
    {
        var item = new Item
        {
            Type = Enum.Parse<ItemType>(req.Type, true),
            Name = req.Name,
            Platform = req.Platform,
            Condition = Enum.Parse<ItemCondition>(req.Condition, true),
            LotId = req.LotId,
            PurchasePrice = req.PurchasePrice,
            ShippingCost = req.ShippingCost,
            PurchaseDate = req.PurchaseDate ?? DateTime.UtcNow,
            Notes = req.Notes
        };
        _db.Items.Add(item);
        await _db.SaveChangesAsync();
        await _db.Entry(item).Reference(i => i.Lot).LoadAsync();
        return ToDto(item);
    }

    // ─── Actualizar artículo ───

    public async Task<ItemDto?> UpdateAsync(int id, UpdateItemRequest req)
    {
        var item = await _db.Items.Include(i => i.Lot).FirstOrDefaultAsync(i => i.Id == id);
        if (item == null) return null;

        if (req.Type != null) item.Type = Enum.Parse<ItemType>(req.Type, true);
        if (req.Name != null) item.Name = req.Name;
        if (req.Platform != null) item.Platform = req.Platform;
        if (req.Condition != null) item.Condition = Enum.Parse<ItemCondition>(req.Condition, true);
        if (req.PurchasePrice.HasValue) item.PurchasePrice = req.PurchasePrice.Value;
        if (req.ShippingCost.HasValue) item.ShippingCost = req.ShippingCost.Value;
        if (req.PurchaseDate.HasValue) item.PurchaseDate = req.PurchaseDate.Value;
        if (req.Notes != null) item.Notes = req.Notes;

        await _db.SaveChangesAsync();
        return ToDto(item);
    }

    // ─── Vender artículo ───

    public async Task<ItemDto?> SellAsync(int id, SellItemRequest req)
    {
        var item = await _db.Items.Include(i => i.Lot).FirstOrDefaultAsync(i => i.Id == id);
        if (item == null || item.IsSold) return null;

        item.IsSold = true;
        item.SalePrice = req.SalePrice;
        item.SaleDate = req.SaleDate ?? DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return ToDto(item);
    }

    // ─── Deshacer venta ───

    public async Task<ItemDto?> UnsellAsync(int id)
    {
        var item = await _db.Items.Include(i => i.Lot).FirstOrDefaultAsync(i => i.Id == id);
        if (item == null || !item.IsSold) return null;

        item.IsSold = false;
        item.SalePrice = null;
        item.SaleDate = null;

        await _db.SaveChangesAsync();
        return ToDto(item);
    }

    // ─── Borrar ───

    public async Task<bool> DeleteAsync(int id)
    {
        var item = await _db.Items.FindAsync(id);
        if (item == null) return false;
        _db.Items.Remove(item);
        await _db.SaveChangesAsync();
        return true;
    }
}
