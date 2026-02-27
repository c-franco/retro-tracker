using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using RetroGameTracker.Data;
using RetroGameTracker.Models;

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

    public async Task<ImportResult> ImportItemsFromExcelAsync(Stream fileStream)
    {
        var errors = new List<ImportError>();
        var itemsToInsert = new List<(Item Item, string LotName, string? LotNotes)>();

        using var wb = new XLWorkbook(fileStream);

        if (!wb.Worksheets.Contains("Inventario"))
            return new ImportResult(false, 0, new List<ImportError>
            {
                new(0, "Hoja", "", "No se encontró la hoja 'Inventario' en el archivo Excel.")
            });

        var ws = wb.Worksheet("Inventario");

        // Verificar cabeceras
        var expectedHeaders = ExportService.InventoryHeaders;
        for (int col = 1; col <= expectedHeaders.Length; col++)
        {
            var actual   = ws.Cell(1, col).GetString().Trim();
            var expected = expectedHeaders[col - 1];
            if (!string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase))
                return new ImportResult(false, 0, new List<ImportError>
                {
                    new(1, $"Columna {col}", actual,
                        $"Cabecera incorrecta. Se esperaba '{expected}' pero se encontró '{actual}'. " +
                        "Usa el Excel exportado por la aplicación como plantilla.")
                });
        }

        int lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;

        for (int rowNum = 2; rowNum <= lastRow; rowNum++)
        {
            if (ws.Row(rowNum).IsEmpty()) continue;

            var row = ws.Row(rowNum);

            // Leer string de una celda
            string Get(int col) => row.Cell(col).GetString().Trim();

            // Leer decimal directamente del valor numérico de la celda (evita problemas de locale)
            bool GetDecimal(int col, out decimal value)
            {
                var cell = row.Cell(col);
                // Intentar obtener el valor numérico nativo de la celda
                try
                {
                    value = (decimal)cell.Value.GetNumber();
                    return true;
                }
                catch { }
                // Fallback: parsear el string intentando ambas culturas
                var s = cell.GetString().Trim();
                if (decimal.TryParse(s, System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out value)) return true;
                if (decimal.TryParse(s, System.Globalization.NumberStyles.Any,
                        new System.Globalization.CultureInfo("es-ES"), out value)) return true;
                return false;
            }

            // ── Col 3: Nombre (obligatorio) ──
            var name = Get(3);
            if (string.IsNullOrWhiteSpace(name))
            {
                errors.Add(new(rowNum, "Nombre", name, "El nombre es obligatorio."));
                continue;
            }

            // ── Col 2: Tipo ──
            var typeStr = Get(2);
            if (!Enum.TryParse<ItemType>(typeStr, true, out var itemType))
                errors.Add(new(rowNum, "Tipo", typeStr,
                    "Valor no válido. Debe ser: Console, VideoGame o Accessory."));

            // ── Col 5: Condicion ──
            var condStr = Get(5);
            if (!Enum.TryParse<ItemCondition>(condStr, true, out var itemCondition))
                errors.Add(new(rowNum, "Condicion", condStr,
                    "Valor no válido. Debe ser: New, Used o NeedsRepair."));

            // ── Col 9: Precio Compra ──
            if (!GetDecimal(9, out var purchasePrice) || purchasePrice < 0)
                errors.Add(new(rowNum, "Precio Compra", Get(9),
                    "Debe ser un número decimal mayor o igual a 0."));

            // ── Col 10: Envio ──
            if (!GetDecimal(10, out var shippingCost) || shippingCost < 0)
                errors.Add(new(rowNum, "Envio", Get(10),
                    "Debe ser un número decimal mayor o igual a 0."));

            // ── Col 12: Fecha Compra ──
            if (!TryParseDate(row.Cell(12), out var purchaseDate))
                errors.Add(new(rowNum, "Fecha Compra", Get(12),
                    "Formato de fecha no válido. Use dd/MM/yyyy."));
            else if (purchaseDate > DateTime.UtcNow.AddDays(1))
                errors.Add(new(rowNum, "Fecha Compra", Get(12),
                    "La fecha de compra no puede ser futura."));

            // ── Col 13: Vendido ──
            var soldStr = Get(13);
            bool isSold = soldStr.Equals("Si", StringComparison.OrdinalIgnoreCase)
                       || soldStr.Equals("Sí", StringComparison.OrdinalIgnoreCase)
                       || soldStr == "1";
            bool isNotSold = soldStr.Equals("No", StringComparison.OrdinalIgnoreCase)
                          || soldStr == "0";
            if (!isSold && !isNotSold)
                errors.Add(new(rowNum, "Vendido", soldStr,
                    "Valor no válido. Debe ser 'Si' o 'No'."));

            // ── Col 14: Precio Venta (obligatorio si Vendido = Si) ──
            decimal? salePrice = null;
            if (isSold)
            {
                if (!GetDecimal(14, out var sp) || sp <= 0)
                    errors.Add(new(rowNum, "Precio Venta", Get(14),
                        "Si el artículo está vendido, el precio de venta debe ser mayor que 0."));
                else
                    salePrice = sp;
            }

            // ── Col 15: Fecha Venta (obligatoria si Vendido = Si) ──
            DateTime? saleDate = null;
            if (isSold)
            {
                if (!TryParseDate(row.Cell(15), out var sd))
                    errors.Add(new(rowNum, "Fecha Venta", Get(15),
                        "Si el artículo está vendido, la fecha de venta debe ser válida (dd/MM/yyyy)."));
                else if (sd > DateTime.UtcNow.AddDays(1))
                    errors.Add(new(rowNum, "Fecha Venta", Get(15),
                        "La fecha de venta no puede ser futura."));
                else
                    saleDate = sd;
            }

            // ── Col 17: Coleccion ──
            var collectionStr = Get(17);
            bool isCollection = collectionStr.Equals("Si", StringComparison.OrdinalIgnoreCase)
                             || collectionStr.Equals("Sí", StringComparison.OrdinalIgnoreCase)
                             || collectionStr == "1";
            bool isNotCollection = collectionStr.Equals("No", StringComparison.OrdinalIgnoreCase)
                                || collectionStr == "0"
                                || string.IsNullOrWhiteSpace(collectionStr);
            if (!isCollection && !isNotCollection)
                errors.Add(new(rowNum, "Coleccion", collectionStr,
                    "Valor no válido. Debe ser 'Si' o 'No'."));

            if (errors.Any(e => e.Row == rowNum)) continue;

            // ── Col 8: Notas Lote (se usa al crear/actualizar el lote) ──
            var lotNotes = Get(8).NullIfEmpty();

            itemsToInsert.Add((new Item
            {
                Type          = itemType,
                Name          = name,
                Platform      = Get(4).NullIfEmpty(),
                Condition     = itemCondition,
                PurchasePrice = purchasePrice,
                ShippingCost  = shippingCost,
                PurchaseDate  = purchaseDate,
                IsSold        = isSold,
                SalePrice     = salePrice,
                SaleDate      = saleDate,
                IsCollection  = isCollection,
                Notes         = Get(18).NullIfEmpty()
            }, Get(7), lotNotes));
        }

        if (errors.Any())
            return new ImportResult(false, 0, errors);

        if (!itemsToInsert.Any())
            return new ImportResult(false, 0, new List<ImportError>
            {
                new(0, "", "", "El archivo no contiene filas de datos para importar.")
            });

        // ── Crear lotes que no existan y asignar LotId ──
        var existingLots = await _db.Lots.ToListAsync();
        // Mapa nombre → Lot (incluye los que crearemos ahora)
        var lotMap = existingLots.ToDictionary(l => l.Name, l => l, StringComparer.OrdinalIgnoreCase);

        // Detectar nombres de lote nuevos (excluir "Sin lote" y vacíos)
        var newLotNames = itemsToInsert
            .Select(t => t.LotName)
            .Where(n => !string.IsNullOrWhiteSpace(n) && n != "Sin lote" && !lotMap.ContainsKey(n))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Actualizar notas de lotes ya existentes si estaban vacías
        foreach (var (_, lotName, lotNotes) in itemsToInsert)
        {
            if (!string.IsNullOrWhiteSpace(lotName) && lotName != "Sin lote"
                && lotNotes != null && lotMap.TryGetValue(lotName, out var existingLot)
                && string.IsNullOrWhiteSpace(existingLot.Notes))
                existingLot.Notes = lotNotes;
        }

        foreach (var lotName in newLotNames)
        {
            // Inferir fecha y notas del lote a partir del primer ítem que lo menciona
            var firstEntry = itemsToInsert.First(t => t.LotName.Equals(lotName, StringComparison.OrdinalIgnoreCase));
            var newLot = new Lot
            {
                Name               = lotName,
                PurchaseDate       = firstEntry.Item.PurchaseDate,
                Notes              = firstEntry.LotNotes,
                TotalPurchasePrice = 0,
                TotalShippingCost  = 0
            };
            _db.Lots.Add(newLot);
            await _db.SaveChangesAsync(); // necesitamos el Id generado
            lotMap[lotName] = newLot;
        }

        // Asignar LotId a cada ítem
        foreach (var (item, lotName, _) in itemsToInsert)
        {
            if (!string.IsNullOrWhiteSpace(lotName) && lotName != "Sin lote"
                && lotMap.TryGetValue(lotName, out var lot))
                item.LotId = lot.Id;
        }

        _db.Items.AddRange(itemsToInsert.Select(t => t.Item));
        await _db.SaveChangesAsync(); // guarda ítems y notas de lotes actualizadas

        return new ImportResult(true, itemsToInsert.Count, new List<ImportError>());
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    /// Lee una fecha de una celda intentando primero su valor nativo y luego string
    private static bool TryParseDate(IXLCell cell, out DateTime result)
    {
        // Valor nativo de Excel (DateTime)
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

        // Serial numérico de Excel
        if (double.TryParse(s, out var serial) && serial > 0)
        {
            try { result = DateTime.FromOADate(serial); return true; }
            catch { }
        }

        result = default;
        return false;
    }
}

internal static class StringExtensions
{
    public static string? NullIfEmpty(this string s) =>
        string.IsNullOrWhiteSpace(s) ? null : s;
}
