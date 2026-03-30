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
        item.Lot?.Code,
        item.PurchasePrice,
        item.ShippingCost,
        item.TotalCost,
        item.PurchaseDate,
        item.IsSold,
        item.SalePrice,
        item.SaleDate,
        item.Profit,
        item.Notes,
        item.IsCollection,
        item.ItemTags.Select(it => it.Tag.Name).OrderBy(t => t).ToList()
    );

    // ─── Consultas ───

    public async Task<List<ItemDto>> GetAllAsync(
        string? platform = null,
        string? type = null,
        string? condition = null,
        bool? isSold = null,
        bool? isCollection = null,
        string? search = null,
        List<string>? tags = null)
    {
        var query = _db.Items
            .Include(i => i.Lot)
            .Include(i => i.ItemTags).ThenInclude(it => it.Tag)
            .AsQueryable();

        if (!string.IsNullOrEmpty(platform))
            query = query.Where(i => i.Platform != null &&
                i.Platform.ToLower() == platform.ToLower());

        if (!string.IsNullOrEmpty(type) && Enum.TryParse<ItemType>(type, true, out var t))
            query = query.Where(i => i.Type == t);

        if (!string.IsNullOrEmpty(condition) && Enum.TryParse<ItemCondition>(condition, true, out var c))
            query = query.Where(i => i.Condition == c);

        if (isSold.HasValue)
            query = query.Where(i => i.IsSold == isSold.Value);

        if (isCollection.HasValue)
            query = query.Where(i => i.IsCollection == isCollection.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalizedSearch = search.Trim().ToLower();
            query = query.Where(i =>
                i.Name.ToLower().Contains(normalizedSearch) ||
                (i.Lot != null && i.Lot.Code.ToLower().Contains(normalizedSearch)));
        }

        // Filtro por tags: el artículo debe tener TODOS los tags indicados
        if (tags != null && tags.Count > 0)
        {
            foreach (var tag in tags)
            {
                var t2 = tag.ToLower();
                query = query.Where(i => i.ItemTags.Any(it => it.Tag.Name.ToLower() == t2));
            }
        }

        var items = await query.OrderByDescending(i => i.PurchaseDate).ToListAsync();
        return items.Select(ToDto).ToList();
    }

    public async Task<ItemDto?> GetByIdAsync(int id)
    {
        var item = await _db.Items
            .Include(i => i.Lot)
            .Include(i => i.ItemTags).ThenInclude(it => it.Tag)
            .FirstOrDefaultAsync(i => i.Id == id);
        return item == null ? null : ToDto(item);
    }

    // ─── Crear artículo ───

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
            Notes = req.Notes,
            IsCollection = req.IsCollection
        };
        _db.Items.Add(item);
        await _db.SaveChangesAsync();

        if (req.Tags != null && req.Tags.Count > 0)
            await SyncTagsAsync(item, req.Tags);

        await _db.Entry(item).Reference(i => i.Lot).LoadAsync();
        await _db.Entry(item).Collection(i => i.ItemTags).Query()
            .Include(it => it.Tag).LoadAsync();
        return ToDto(item);
    }

    // ─── Actualizar artículo ───

    public async Task<ItemDto?> UpdateAsync(int id, UpdateItemRequest req)
    {
        var item = await _db.Items
            .Include(i => i.Lot)
            .Include(i => i.ItemTags).ThenInclude(it => it.Tag)
            .FirstOrDefaultAsync(i => i.Id == id);
        if (item == null) return null;

        if (req.Type != null) item.Type = Enum.Parse<ItemType>(req.Type, true);
        if (req.Name != null) item.Name = req.Name;
        if (req.Platform != null) item.Platform = req.Platform;
        if (req.Condition != null) item.Condition = Enum.Parse<ItemCondition>(req.Condition, true);
        if (req.PurchasePrice.HasValue) item.PurchasePrice = req.PurchasePrice.Value;
        if (req.ShippingCost.HasValue) item.ShippingCost = req.ShippingCost.Value;
        if (req.PurchaseDate.HasValue) item.PurchaseDate = req.PurchaseDate.Value;
        if (req.Notes != null) item.Notes = req.Notes;
        if (req.IsCollection.HasValue) item.IsCollection = req.IsCollection.Value;
        if (req.UnlinkLot) item.LotId = null;
        else if (req.LotId.HasValue) item.LotId = req.LotId.Value;

        if (req.Tags != null)
            await SyncTagsAsync(item, req.Tags);

        await _db.SaveChangesAsync();
        return ToDto(item);
    }

    // ─── Vender artículo ───

    public async Task<ItemDto?> SellAsync(int id, SellItemRequest req)
    {
        var item = await _db.Items
            .Include(i => i.Lot)
            .Include(i => i.ItemTags).ThenInclude(it => it.Tag)
            .FirstOrDefaultAsync(i => i.Id == id);
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
        var item = await _db.Items
            .Include(i => i.Lot)
            .Include(i => i.ItemTags).ThenInclude(it => it.Tag)
            .FirstOrDefaultAsync(i => i.Id == id);
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
        var item = await _db.Items
            .Include(i => i.ItemTags)
            .FirstOrDefaultAsync(i => i.Id == id);
        if (item == null) return false;

        _db.ItemTags.RemoveRange(item.ItemTags);
        _db.Items.Remove(item);
        await _db.SaveChangesAsync();

        // Limpiar tags huérfanos (sin ningún artículo asociado)
        var orphans = await _db.Tags
            .Where(t => !t.ItemTags.Any())
            .ToListAsync();
        _db.Tags.RemoveRange(orphans);
        await _db.SaveChangesAsync();

        return true;
    }

    // ─── Helper: sincronizar tags ───

    /// <summary>
    /// Crea los tags que no existan, elimina los que ya no están en la lista,
    /// y añade los nuevos. Limpia tags huérfanos (sin artículos).
    /// </summary>
    private async Task SyncTagsAsync(Item item, List<string> tagNames)
    {
        // Normalizar: minúsculas, sin espacios extra, sin duplicados
        var normalized = tagNames
            .Select(t => t.Trim().ToLower())
            .Where(t => t.Length > 0)
            .Distinct()
            .ToList();

        // Cargar los ItemTags actuales del artículo
        var existing = await _db.ItemTags
            .Include(it => it.Tag)
            .Where(it => it.ItemId == item.Id)
            .ToListAsync();

        // Quitar los que ya no están en la lista nueva
        var toRemove = existing.Where(it => !normalized.Contains(it.Tag.Name)).ToList();
        _db.ItemTags.RemoveRange(toRemove);

        // Añadir los que faltan
        var existingNames = existing
            .Where(it => normalized.Contains(it.Tag.Name))
            .Select(it => it.Tag.Name)
            .ToHashSet();

        foreach (var name in normalized.Where(n => !existingNames.Contains(n)))
        {
            // Buscar o crear el tag
            var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Name == name);
            if (tag == null)
            {
                tag = new Tag { Name = name };
                _db.Tags.Add(tag);
                await _db.SaveChangesAsync();
            }

            _db.ItemTags.Add(new ItemTag { ItemId = item.Id, TagId = tag.Id });
        }

        await _db.SaveChangesAsync();

        // Limpiar tags huérfanos (sin ningún artículo asociado)
        var orphans = await _db.Tags
            .Where(t => !t.ItemTags.Any())
            .ToListAsync();
        _db.Tags.RemoveRange(orphans);
        await _db.SaveChangesAsync();

        // Recargar la colección en memoria
        await _db.Entry(item).Collection(i => i.ItemTags).Query()
            .Include(it => it.Tag).LoadAsync();
    }
}
