using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RetroGameTracker.Data;
using RetroGameTracker.DTOs;
using RetroGameTracker.Services;

namespace RetroGameTracker.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly DashboardService _service;

    public DashboardController(DashboardService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await _service.GetDashboardAsync());
}

[ApiController]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly AppDbContext _db;

    public SettingsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var s = await _db.AppSettings.FirstAsync();
        return Ok(new SettingsDto(s.InitialBalance, s.Currency));
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateSettingsRequest req)
    {
        var s = await _db.AppSettings.FirstAsync();
        s.InitialBalance = req.InitialBalance;
        s.Currency = req.Currency;
        s.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new SettingsDto(s.InitialBalance, s.Currency));
    }
}

[ApiController]
[Route("api/[controller]")]
public class ExportController : ControllerBase
{
    private readonly ExportService _service;

    public ExportController(ExportService service) => _service = service;

    [HttpGet("excel")]
    public async Task<IActionResult> ExportExcel()
    {
        var bytes = await _service.ExportItemsToExcelAsync();
        var filename = $"inventario_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";
        return File(bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename);
    }
}
