using Microsoft.AspNetCore.Mvc;
using RetroGameTracker.Resources;
using RetroGameTracker.Services;

namespace RetroGameTracker.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ImportController : ControllerBase
{
    private readonly ImportService _service;

    public ImportController(ImportService service) => _service = service;

    /// <summary>
    /// Importa artículos desde un fichero Excel con el formato exportado por la aplicación.
    /// Si cualquier fila contiene datos inválidos se cancela toda la importación y se
    /// devuelve la lista de errores con fila, columna y motivo.
    /// </summary>
    [HttpPost("excel")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB máximo
    public async Task<IActionResult> ImportExcel(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = AppText.Get("backend.import.noFile") });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx")
            return BadRequest(new { error = AppText.Get("backend.import.invalidExtension") });

        using var stream = file.OpenReadStream();
        var result = await _service.ImportItemsFromExcelAsync(stream);

        if (!result.Success)
            return UnprocessableEntity(new
            {
                error   = AppText.Get("backend.import.validationFailed"),
                errors  = result.Errors.Select(e => new
                {
                    fila    = e.Row,
                    columna = e.Column,
                    valor   = e.Value,
                    motivo  = e.Reason
                })
            });

        return Ok(new
        {
            message = AppText.Format("backend.import.completed", result.ImportedCount)
        });
    }
}
