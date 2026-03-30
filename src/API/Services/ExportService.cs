using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using RetroGameTracker.Data;
using RetroGameTracker.Resources;

namespace RetroGameTracker.Services;

public class ExportService
{
    private readonly AppDbContext _db;

    public ExportService(AppDbContext db) => _db = db;

    // Columnas del inventario (orden canónico compartido con ImportService)
    // 1:ID  2:Tipo  3:Nombre  4:Plataforma  5:Condicion  6:Estado
    // 7:Codigo Lote  8:Nombre Lote  9:Notas Lote
    // 10:Precio Compra  11:Envio  12:Coste Total
    // 13:Fecha Compra  14:Vendido  15:Precio Venta  16:Fecha Venta  17:Beneficio
    // 18:Coleccion  19:Notas  20:Etiquetas
    public static readonly string[] InventoryHeaders = new[]
    {
        AppText.Get("backend.export.header.id"),
        AppText.Get("backend.export.header.type"),
        AppText.Get("backend.export.header.name"),
        AppText.Get("backend.export.header.platform"),
        AppText.Get("backend.export.header.condition"),
        AppText.Get("backend.export.header.state"),
        AppText.Get("backend.export.header.lotCode"),
        AppText.Get("backend.export.header.lotName"),
        AppText.Get("backend.export.header.lotNotes"),
        AppText.Get("backend.export.header.purchasePrice"),
        AppText.Get("backend.export.header.shipping"),
        AppText.Get("backend.export.header.totalCost"),
        AppText.Get("backend.export.header.purchaseDate"),
        AppText.Get("backend.export.header.sold"),
        AppText.Get("backend.export.header.salePrice"),
        AppText.Get("backend.export.header.saleDate"),
        AppText.Get("backend.export.header.benefit"),
        AppText.Get("backend.export.header.collection"),
        AppText.Get("backend.export.header.notes"),
        AppText.Get("backend.export.header.tags")
    };

    public async Task<byte[]> ExportItemsToExcelAsync()
    {
        var items = await _db.Items
            .Include(i => i.Lot)
            .Include(i => i.ItemTags).ThenInclude(it => it.Tag)
            .OrderByDescending(i => i.PurchaseDate)
            .ToListAsync();

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add(AppText.Get("backend.export.inventorySheet"));

        // Encabezados
        for (int col = 1; col <= InventoryHeaders.Length; col++)
        {
            var cell = ws.Cell(1, col);
            cell.Value = InventoryHeaders[col - 1];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#2d6a4f");
            cell.Style.Font.FontColor = XLColor.White;
        }

        // Datos
        int row = 2;
        foreach (var item in items)
        {
            ws.Cell(row, 1).Value  = item.Id;
            ws.Cell(row, 2).Value  = item.Type.ToString();
            ws.Cell(row, 3).Value  = item.Name;
            ws.Cell(row, 4).Value  = item.Platform ?? "";
            ws.Cell(row, 5).Value  = item.Condition.ToString();
            ws.Cell(row, 6).Value  = item.IsSold
                ? AppText.Get("backend.export.state.sold")
                : item.IsCollection
                    ? AppText.Get("backend.export.state.collection")
                    : AppText.Get("backend.export.state.stock");
            ws.Cell(row, 7).Value  = item.Lot?.Code ?? "";
            ws.Cell(row, 8).Value  = item.Lot?.Name ?? "";
            ws.Cell(row, 9).Value  = item.Lot?.Notes ?? "";
            ws.Cell(row, 10).Value = item.PurchasePrice;
            ws.Cell(row, 11).Value = item.ShippingCost;
            ws.Cell(row, 12).Value = item.TotalCost;
            ws.Cell(row, 13).Value = item.PurchaseDate.ToString("dd/MM/yyyy");
            ws.Cell(row, 14).Value = item.IsSold ? AppText.Get("backend.export.yes") : AppText.Get("backend.export.no");
            ws.Cell(row, 15).Value = item.SalePrice.HasValue ? item.SalePrice.Value : 0;
            ws.Cell(row, 16).Value = item.SaleDate.HasValue ? item.SaleDate.Value.ToString("dd/MM/yyyy") : "";
            ws.Cell(row, 17).Value = item.Profit.HasValue ? item.Profit.Value : 0;
            ws.Cell(row, 18).Value = item.IsCollection ? AppText.Get("backend.export.yes") : AppText.Get("backend.export.no");
            ws.Cell(row, 19).Value = item.Notes ?? "";
            ws.Cell(row, 20).Value = string.Join(", ",
                item.ItemTags.Select(it => it.Tag.Name).OrderBy(t => t));

            if (item.IsSold)
                ws.Row(row).Style.Fill.BackgroundColor = XLColor.FromHtml("#d8f3dc");
            else if (item.IsCollection)
                ws.Row(row).Style.Fill.BackgroundColor = XLColor.FromHtml("#fff9c4");
            else
                ws.Row(row).Style.Fill.BackgroundColor = XLColor.FromHtml("#f0f0f0");

            row++;
        }

        // Segunda hoja: Lotes
        var lotsSheet = wb.Worksheets.Add(AppText.Get("backend.export.lotsSheet"));
        var lots = await _db.Lots.Include(l => l.Items).OrderBy(l => l.Code).ToListAsync();

        string[] lotHeaders =
        {
            AppText.Get("backend.export.lotHeader.code"),
            AppText.Get("backend.export.header.name"),
            AppText.Get("backend.export.header.notes"),
            AppText.Get("backend.export.lotHeader.purchaseDate"),
            AppText.Get("backend.export.lotHeader.items"),
            AppText.Get("backend.export.lotHeader.soldItems"),
            AppText.Get("backend.export.lotHeader.invested"),
            AppText.Get("backend.export.lotHeader.recovered"),
            AppText.Get("backend.export.lotHeader.profit")
        };
        for (int col = 1; col <= lotHeaders.Length; col++)
        {
            var cell = lotsSheet.Cell(1, col);
            cell.Value = lotHeaders[col - 1];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#2d6a4f");
            cell.Style.Font.FontColor = XLColor.White;
        }

        int lotRow = 2;
        foreach (var lot in lots)
        {
            var soldItems = lot.Items.Where(i => i.IsSold).ToList();
            var totalCost = lot.Items.Sum(i => i.TotalCost);
            var totalRev  = soldItems.Sum(i => i.SalePrice ?? 0);
            lotsSheet.Cell(lotRow, 1).Value = lot.Code;
            lotsSheet.Cell(lotRow, 2).Value = lot.Name;
            lotsSheet.Cell(lotRow, 3).Value = lot.Notes ?? "";
            lotsSheet.Cell(lotRow, 4).Value = lot.PurchaseDate.ToString("dd/MM/yyyy");
            lotsSheet.Cell(lotRow, 5).Value = lot.Items.Count;
            lotsSheet.Cell(lotRow, 6).Value = soldItems.Count;
            lotsSheet.Cell(lotRow, 7).Value = totalCost;
            lotsSheet.Cell(lotRow, 8).Value = totalRev;
            lotsSheet.Cell(lotRow, 9).Value = totalRev - totalCost;
            lotRow++;
        }

        // Tercera hoja: Resumen financiero
        var wsSummary = wb.Worksheets.Add(AppText.Get("backend.export.summarySheet"));
        var settings  = await _db.AppSettings.FirstAsync();
        decimal totalInvested = items.Sum(i => i.TotalCost);
        decimal totalRevenue  = items.Where(i => i.IsSold).Sum(i => i.SalePrice ?? 0);
        decimal totalProfit   = totalRevenue - totalInvested;

        wsSummary.Cell("A1").Value = AppText.Get("backend.export.summary.concept");
        wsSummary.Cell("B1").Value = AppText.Get("backend.export.summary.value");
        wsSummary.Cell("A1").Style.Font.Bold = true;
        wsSummary.Cell("B1").Style.Font.Bold = true;
        wsSummary.Cell("A2").Value = AppText.Get("backend.export.summary.initialBalance"); wsSummary.Cell("B2").Value = settings.InitialBalance;
        wsSummary.Cell("A3").Value = AppText.Get("backend.export.summary.totalInvested");  wsSummary.Cell("B3").Value = totalInvested;
        wsSummary.Cell("A4").Value = AppText.Get("backend.export.summary.totalRecovered"); wsSummary.Cell("B4").Value = totalRevenue;
        wsSummary.Cell("A5").Value = AppText.Get("backend.export.summary.netProfit");      wsSummary.Cell("B5").Value = totalProfit;
        wsSummary.Cell("A6").Value = AppText.Get("backend.export.summary.finalBalance");   wsSummary.Cell("B6").Value = settings.InitialBalance + totalProfit;

        ws.Columns().AdjustToContents();
        lotsSheet.Columns().AdjustToContents();
        wsSummary.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }
}
