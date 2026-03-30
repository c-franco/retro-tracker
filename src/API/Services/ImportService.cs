using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using RetroGameTracker.Data;
using RetroGameTracker.Models;
using RetroGameTracker.Resources;

namespace RetroGameTracker.Services;

public class ImportService
{
    private readonly AppDbContext _db;

    public ImportService(AppDbContext db) => _db = db;

    public record ImportError(int Row, string Column, string Value, string Reason);

    public record ImportResult(
        bool Success,
        int ImportedCount,
        List<ImportError> Errors
    );

    // Posiciones de columna (1-based) — deben coincidir con ExportService.InventoryHeaders
    private const int C_ID           = 1;
    private const int C_TYPE         = 2;
    private const int C_NAME         = 3;
    private const int C_PLATFORM     = 4;
    private const int C_CONDITION    = 5;
    private const int C_STATUS       = 6;   // Estado (informativo, no se importa)
    private const int C_LOT_CODE     = 7;   // Codigo Lote
    private const int C_LOT_NAME     = 8;   // Nombre Lote
    private const int C_LOT_NOTES    = 9;   // Notas Lote
    private const int C_PRICE        = 10;  // Precio Compra
    private const int C_SHIPPING     = 11;  // Envio
    private const int C_TOTAL        = 12;  // Coste Total (calculado, no se importa)
    private const int C_PURCHASE_DATE = 13; // Fecha Compra
    private const int C_SOLD         = 14;  // Vendido
    private const int C_SALE_PRICE   = 15;  // Precio Venta
    private const int C_SALE_DATE    = 16;  // Fecha Venta
    private const int C_BENEFIT      = 17;  // Beneficio (calculado, no se importa)
    private const int C_COLLECTION   = 18;  // Coleccion
    private const int C_NOTES        = 19;  // Notas
    private const int C_TAGS         = 20;  // Etiquetas

    public async Task<ImportResult> ImportItemsFromExcelAsync(Stream fileStream)
    {
        var errors        = new List<ImportError>();
        var itemsToInsert = new List<(Item Item, string LotCode, string LotName, string? LotNotes, List<string> Tags)>();

        using var wb = new XLWorkbook(fileStream);
        var importedInitialBalance = TryReadInitialBalance(wb, out var initialBalance)
            ? initialBalance
            : (decimal?)null;

        var inventorySheetName = AppText.Get("backend.export.inventorySheet");
        if (!wb.Worksheets.Contains(inventorySheetName))
            return new ImportResult(false, 0, new List<ImportError>
            {
                new(0, AppText.Get("backend.import.sheetColumn"), string.Empty, AppText.Get("backend.import.sheetNotFound"))
            });

        var ws = wb.Worksheet(inventorySheetName);

        // Verificar cabeceras
        var expectedHeaders = ExportService.InventoryHeaders;
        for (int col = 1; col <= expectedHeaders.Length; col++)
        {
            var actual   = ws.Cell(1, col).GetString().Trim();
            var expected = expectedHeaders[col - 1];
            if (!string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase))
                return new ImportResult(false, 0, new List<ImportError>
                {
                    new(1, AppText.Format("backend.import.column", col), actual, AppText.Format("backend.import.invalidHeader", expected, actual))
                });
        }

        int lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;

        for (int rowNum = 2; rowNum <= lastRow; rowNum++)
        {
            if (ws.Row(rowNum).IsEmpty()) continue;

            var row = ws.Row(rowNum);

            string Get(int col) => row.Cell(col).GetString().Trim();

            bool GetDecimal(int col, out decimal value)
            {
                var cell = row.Cell(col);
                try { value = (decimal)cell.Value.GetNumber(); return true; } catch { }
                var s = cell.GetString().Trim();
                if (decimal.TryParse(s, System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out value)) return true;
                if (decimal.TryParse(s, System.Globalization.NumberStyles.Any,
                        new System.Globalization.CultureInfo("es-ES"), out value)) return true;
                return false;
            }

            // ── Col 3: Nombre (obligatorio) ──
            var name = Get(C_NAME);
            if (string.IsNullOrWhiteSpace(name))
            {
                errors.Add(new(rowNum, AppText.Get("backend.export.header.name"), name, AppText.Get("backend.import.requiredName")));
                continue;
            }

            // ── Col 2: Tipo ──
            var typeStr = Get(C_TYPE);
            if (!Enum.TryParse<ItemType>(typeStr, true, out var itemType))
                errors.Add(new(rowNum, AppText.Get("backend.export.header.type"), typeStr, AppText.Get("backend.import.invalidType")));

            // ── Col 5: Condicion ──
            var condStr = Get(C_CONDITION);
            if (!Enum.TryParse<ItemCondition>(condStr, true, out var itemCondition))
                errors.Add(new(rowNum, AppText.Get("backend.export.header.condition"), condStr, AppText.Get("backend.import.invalidCondition")));

            // ── Col 10: Precio Compra ──
            if (!GetDecimal(C_PRICE, out var purchasePrice) || purchasePrice < 0)
                errors.Add(new(rowNum, AppText.Get("backend.export.header.purchasePrice"), Get(C_PRICE), AppText.Get("backend.import.invalidNonNegativeDecimal")));

            // ── Col 11: Envio ──
            if (!GetDecimal(C_SHIPPING, out var shippingCost) || shippingCost < 0)
                errors.Add(new(rowNum, AppText.Get("backend.export.header.shipping"), Get(C_SHIPPING), AppText.Get("backend.import.invalidNonNegativeDecimal")));

            // ── Col 13: Fecha Compra ──
            if (!TryParseDate(row.Cell(C_PURCHASE_DATE), out var purchaseDate))
                errors.Add(new(rowNum, AppText.Get("backend.export.header.purchaseDate"), Get(C_PURCHASE_DATE), AppText.Get("backend.import.invalidDate")));
            else if (purchaseDate > DateTime.UtcNow.AddDays(1))
                errors.Add(new(rowNum, AppText.Get("backend.export.header.purchaseDate"), Get(C_PURCHASE_DATE), AppText.Get("backend.import.futurePurchaseDate")));

            // ── Col 14: Vendido ──
            var soldStr = Get(C_SOLD);
            bool isSold = soldStr.Equals("Si", StringComparison.OrdinalIgnoreCase)
                       || soldStr.Equals("Sí", StringComparison.OrdinalIgnoreCase)
                       || soldStr == "1";
            bool isNotSold = soldStr.Equals("No", StringComparison.OrdinalIgnoreCase)
                          || soldStr == "0";
            if (!isSold && !isNotSold)
                errors.Add(new(rowNum, AppText.Get("backend.export.header.sold"), soldStr, AppText.Get("backend.import.invalidBoolean")));

            // ── Col 15: Precio Venta (obligatorio si Vendido = Si) ──
            decimal? salePrice = null;
            if (isSold)
            {
                if (!GetDecimal(C_SALE_PRICE, out var sp) || sp <= 0)
                    errors.Add(new(rowNum, AppText.Get("backend.export.header.salePrice"), Get(C_SALE_PRICE), AppText.Get("backend.import.invalidSalePrice")));
                else
                    salePrice = sp;
            }

            // ── Col 16: Fecha Venta (obligatoria si Vendido = Si) ──
            DateTime? saleDate = null;
            if (isSold)
            {
                if (!TryParseDate(row.Cell(C_SALE_DATE), out var sd))
                    errors.Add(new(rowNum, AppText.Get("backend.export.header.saleDate"), Get(C_SALE_DATE), AppText.Get("backend.import.invalidSaleDate")));
                else if (sd > DateTime.UtcNow.AddDays(1))
                    errors.Add(new(rowNum, AppText.Get("backend.export.header.saleDate"), Get(C_SALE_DATE), AppText.Get("backend.import.futureSaleDate")));
                else
                    saleDate = sd;
            }

            // ── Col 18: Coleccion ──
            var collectionStr = Get(C_COLLECTION);
            bool isCollection = collectionStr.Equals("Si", StringComparison.OrdinalIgnoreCase)
                             || collectionStr.Equals("Sí", StringComparison.OrdinalIgnoreCase)
                             || collectionStr == "1";
            bool isNotCollection = collectionStr.Equals("No", StringComparison.OrdinalIgnoreCase)
                                || collectionStr == "0"
                                || string.IsNullOrWhiteSpace(collectionStr);
            if (!isCollection && !isNotCollection)
                errors.Add(new(rowNum, AppText.Get("backend.export.header.collection"), collectionStr, AppText.Get("backend.import.invalidBoolean")));

            // ── Validación cruzada: no puede estar vendido Y en colección ──
            if (isSold && isCollection)
                errors.Add(new(rowNum, AppText.Get("backend.export.header.state"), $"Vendido={soldStr} / Coleccion={collectionStr}", AppText.Get("backend.import.soldAndCollection")));

            if (errors.Any(e => e.Row == rowNum)) continue;

            // ── Col 7: Código Lote ──
            var lotCode  = Get(C_LOT_CODE).NullIfEmpty();
            var lotName  = Get(C_LOT_NAME).NullIfEmpty();
            var lotNotes = Get(C_LOT_NOTES).NullIfEmpty();

            // ── Col 20: Etiquetas (opcional, separadas por coma) ──
            var tagsRaw  = Get(C_TAGS);
            var tagNames = string.IsNullOrWhiteSpace(tagsRaw)
                ? new List<string>()
                : tagsRaw.Split(',', StringSplitOptions.RemoveEmptyEntries)
                         .Select(t => t.Trim().ToLower())
                         .Where(t => t.Length > 0)
                         .Distinct()
                         .ToList();

            itemsToInsert.Add((new Item
            {
                Type          = itemType,
                Name          = name,
                Platform      = Get(C_PLATFORM).NullIfEmpty(),
                Condition     = itemCondition,
                PurchasePrice = purchasePrice,
                ShippingCost  = shippingCost,
                PurchaseDate  = purchaseDate,
                IsSold        = isSold,
                SalePrice     = salePrice,
                SaleDate      = saleDate,
                IsCollection  = isCollection,
                Notes         = Get(C_NOTES).NullIfEmpty()
            }, lotCode ?? "", lotName ?? "", lotNotes, tagNames));
        }

        if (errors.Any())
            return new ImportResult(false, 0, errors);

        if (!itemsToInsert.Any())
            return new ImportResult(false, 0, new List<ImportError>
            {
                new(0, string.Empty, string.Empty, AppText.Get("backend.import.noRows"))
            });

        // ── Resolver lotes ────────────────────────────────────────────────
        // Prioridad: Código Lote > Nombre Lote > sin lote
        var existingLots     = await _db.Lots.ToListAsync();
        var lotByCode        = existingLots.ToDictionary(l => l.Code, l => l, StringComparer.OrdinalIgnoreCase);
        var lotByName        = existingLots.ToDictionary(l => l.Name, l => l, StringComparer.OrdinalIgnoreCase);

        // Calcular cuántos lotes existen para el siguiente número de código
        int nextLotNumber = existingLots
            .Select(l => { int n; return int.TryParse(l.Code.Replace(AppText.Get("backend.import.lotPrefix"), ""), out n) ? n : 0; })
            .Where(n => n > 0)
            .DefaultIfEmpty(0)
            .Max() + 1;

        // Mapa definitivo: clave = (lotCode|lotName) → Lot
        var resolvedLots = new Dictionary<string, Lot>(StringComparer.OrdinalIgnoreCase);

        foreach (var (item, lotCode, lotName, lotNotes, _) in itemsToInsert)
        {
            if (string.IsNullOrWhiteSpace(lotCode) && string.IsNullOrWhiteSpace(lotName))
                continue; // sin lote

            // Clave de resolución: preferimos el código
            var key = !string.IsNullOrWhiteSpace(lotCode) ? lotCode : lotName;

            if (resolvedLots.ContainsKey(key)) continue; // ya procesado

            // 1. Buscar por código exacto
            if (!string.IsNullOrWhiteSpace(lotCode) && lotByCode.TryGetValue(lotCode, out var foundByCode))
            {
                resolvedLots[key] = foundByCode;
                continue;
            }

            // 2. Buscar por nombre si no hay código
            if (!string.IsNullOrWhiteSpace(lotName) && lotByName.TryGetValue(lotName, out var foundByName))
            {
                resolvedLots[key] = foundByName;
                continue;
            }

            // 3. Crear lote nuevo
            var newCode = !string.IsNullOrWhiteSpace(lotCode)
                ? lotCode
                : $"{AppText.Get("backend.import.lotPrefix")}{nextLotNumber++:D3}";

            var newLot = new Lot
            {
                Code               = newCode,
                Name               = !string.IsNullOrWhiteSpace(lotName) ? lotName : newCode,
                Notes              = lotNotes,
                PurchaseDate       = item.PurchaseDate,
                TotalPurchasePrice = 0,
                TotalShippingCost  = 0
            };
            _db.Lots.Add(newLot);
            await _db.SaveChangesAsync();
            lotByCode[newCode]      = newLot;
            if (!string.IsNullOrWhiteSpace(lotName)) lotByName[lotName] = newLot;
            resolvedLots[key]       = newLot;
        }

        // Asignar LotId a cada artículo
        foreach (var (item, lotCode, lotName, _, _) in itemsToInsert)
        {
            var key = !string.IsNullOrWhiteSpace(lotCode) ? lotCode : lotName;
            if (!string.IsNullOrWhiteSpace(key) && resolvedLots.TryGetValue(key, out var lot))
                item.LotId = lot.Id;
        }

        _db.Items.AddRange(itemsToInsert.Select(t => t.Item));
        await _db.SaveChangesAsync();

        if (importedInitialBalance.HasValue)
        {
            var settings = await _db.AppSettings.FirstAsync();
            settings.InitialBalance = importedInitialBalance.Value;
            settings.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        // ── Asignar etiquetas sin duplicados ─────────────────────────────
        var existingTags = await _db.Tags.ToListAsync();
        var tagMap       = existingTags.ToDictionary(t => t.Name, t => t, StringComparer.OrdinalIgnoreCase);

        foreach (var (item, _, _, _, tagNames) in itemsToInsert)
        {
            if (tagNames.Count == 0) continue;
            foreach (var tagName in tagNames)
            {
                if (!tagMap.TryGetValue(tagName, out var tag))
                {
                    tag = new Tag { Name = tagName };
                    _db.Tags.Add(tag);
                    await _db.SaveChangesAsync();
                    tagMap[tagName] = tag;
                }
                bool alreadyLinked = await _db.ItemTags
                    .AnyAsync(it => it.ItemId == item.Id && it.TagId == tag.Id);
                if (!alreadyLinked)
                    _db.ItemTags.Add(new ItemTag { ItemId = item.Id, TagId = tag.Id });
            }
        }

        await _db.SaveChangesAsync();

        return new ImportResult(true, itemsToInsert.Count, new List<ImportError>());
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private static bool TryParseDate(IXLCell cell, out DateTime result)
    {
        try
        {
            if (cell.Value.IsDateTime)
            {
                result = cell.Value.GetDateTime();
                return true;
            }
        }
        catch { }

        var s = cell.GetString().Trim();
        if (string.IsNullOrWhiteSpace(s)) { result = default; return false; }

        if (DateTime.TryParseExact(s, new[] { "dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd" },
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out result))
            return true;

        if (DateTime.TryParse(s, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out result))
            return true;

        if (double.TryParse(s, out var serial) && serial > 0)
        {
            try { result = DateTime.FromOADate(serial); return true; }
            catch { }
        }

        result = default;
        return false;
    }

    private static bool TryReadInitialBalance(XLWorkbook workbook, out decimal initialBalance)
    {
        initialBalance = default;

        var summarySheetName = AppText.Get("backend.export.summarySheet");
        if (!workbook.Worksheets.Contains(summarySheetName))
            return false;

        var summarySheet = workbook.Worksheet(summarySheetName);
        var lastRow = summarySheet.LastRowUsed()?.RowNumber() ?? 0;
        var initialBalanceLabel = AppText.Get("backend.export.summary.initialBalance");

        for (var row = 1; row <= lastRow; row++)
        {
            var concept = summarySheet.Cell(row, 1).GetString().Trim();
            if (!string.Equals(concept, initialBalanceLabel, StringComparison.OrdinalIgnoreCase))
                continue;

            return TryParseDecimal(summarySheet.Cell(row, 2), out initialBalance);
        }

        return false;
    }

    private static bool TryParseDecimal(IXLCell cell, out decimal value)
    {
        try
        {
            value = (decimal)cell.Value.GetNumber();
            return true;
        }
        catch
        {
            var raw = cell.GetString().Trim();
            if (decimal.TryParse(
                raw,
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out value))
            {
                return true;
            }

            if (decimal.TryParse(
                raw,
                System.Globalization.NumberStyles.Any,
                new System.Globalization.CultureInfo("es-ES"),
                out value))
            {
                return true;
            }

            return false;
        }
    }
}

internal static class StringExtensions
{
    public static string? NullIfEmpty(this string s) =>
        string.IsNullOrWhiteSpace(s) ? null : s;
}
