using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using RetroGameTracker.Data;

namespace RetroGameTracker.Services;

public class ExportService
{
    private readonly AppDbContext _db;

    public ExportService(AppDbContext db) => _db = db;

    public async Task<byte[]> ExportItemsToExcelAsync()
    {
        var items = await _db.Items
            .Include(i => i.Lot)
            .OrderByDescending(i => i.PurchaseDate)
            .ToListAsync();

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Inventario");

        // Encabezados
        var headers = new[]
        {
            "ID", "Tipo", "Nombre", "Plataforma", "Estado", "Lote",
            "Precio Compra", "Envío", "Coste Total",
            "Fecha Compra", "Vendido", "Precio Venta", "Fecha Venta", "Beneficio", "Notas"
        };

        for (int col = 1; col <= headers.Length; col++)
        {
            var cell = ws.Cell(1, col);
            cell.Value = headers[col - 1];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#2d6a4f");
            cell.Style.Font.FontColor = XLColor.White;
        }

        // Datos
        int row = 2;
        foreach (var item in items)
        {
            ws.Cell(row, 1).Value = item.Id;
            ws.Cell(row, 2).Value = item.Type.ToString();
            ws.Cell(row, 3).Value = item.Name;
            ws.Cell(row, 4).Value = item.Platform ?? "";
            ws.Cell(row, 5).Value = item.Condition.ToString();
            ws.Cell(row, 6).Value = item.Lot?.Name ?? "Sin lote";
            ws.Cell(row, 7).Value = item.PurchasePrice;
            ws.Cell(row, 8).Value = item.ShippingCost;
            ws.Cell(row, 9).Value = item.TotalCost;
            ws.Cell(row, 10).Value = item.PurchaseDate.ToString("dd/MM/yyyy");
            ws.Cell(row, 11).Value = item.IsSold ? "Sí" : "No";
            ws.Cell(row, 12).Value = item.SalePrice.HasValue ? item.SalePrice.Value : 0;
            ws.Cell(row, 13).Value = item.SaleDate.HasValue ? item.SaleDate.Value.ToString("dd/MM/yyyy") : "";
            ws.Cell(row, 14).Value = item.Profit.HasValue ? item.Profit.Value : 0;
            ws.Cell(row, 15).Value = item.Notes ?? "";

            // Color verde para vendidos, amarillo para stock
            if (item.IsSold)
                ws.Row(row).Style.Fill.BackgroundColor = XLColor.FromHtml("#d8f3dc");
            else
                ws.Row(row).Style.Fill.BackgroundColor = XLColor.FromHtml("#fff9c4");

            row++;
        }

        // Segunda hoja: resumen financiero
        var wsSummary = wb.Worksheets.Add("Resumen");
        var settings = await _db.AppSettings.FirstAsync();
        decimal totalInvested = items.Sum(i => i.TotalCost);
        decimal totalRevenue = items.Where(i => i.IsSold).Sum(i => i.SalePrice ?? 0);
        decimal profit = totalRevenue - totalInvested;

        wsSummary.Cell("A1").Value = "Concepto";
        wsSummary.Cell("B1").Value = "Valor (€)";
        wsSummary.Cell("A1").Style.Font.Bold = true;
        wsSummary.Cell("B1").Style.Font.Bold = true;

        wsSummary.Cell("A2").Value = "Saldo inicial";
        wsSummary.Cell("B2").Value = settings.InitialBalance;
        wsSummary.Cell("A3").Value = "Total invertido";
        wsSummary.Cell("B3").Value = totalInvested;
        wsSummary.Cell("A4").Value = "Total recuperado";
        wsSummary.Cell("B4").Value = totalRevenue;
        wsSummary.Cell("A5").Value = "Beneficio neto";
        wsSummary.Cell("B5").Value = profit;
        wsSummary.Cell("A6").Value = "Balance final";
        wsSummary.Cell("B6").Value = settings.InitialBalance + profit;

        ws.Columns().AdjustToContents();
        wsSummary.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }
}
