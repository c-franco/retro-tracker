using Microsoft.AspNetCore.Mvc;
using RetroGameTracker.DTOs;
using RetroGameTracker.Services;

namespace RetroGameTracker.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LotsController : ControllerBase
{
    private readonly LotService _service;

    public LotsController(LotService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _service.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var lot = await _service.GetByIdAsync(id);
        return lot == null ? NotFound() : Ok(lot);
    }

    /// <summary>
    /// Crea un lote con sus artículos. Ejemplo de body:
    /// {
    ///   "name": "Lote DSi + Juego",
    ///   "totalPurchasePrice": 100,
    ///   "totalShippingCost": 10,
    ///   "items": [
    ///     { "type": "Console", "name": "Nintendo DSi", "platform": "DS",
    ///       "condition": "Used", "purchasePrice": 70, "shippingCost": 7 },
    ///     { "type": "VideoGame", "name": "New Super Mario Bros", "platform": "DS",
    ///       "condition": "Used", "purchasePrice": 30, "shippingCost": 3 }
    ///   ]
    /// }
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLotRequest req)
    {
        var lot = await _service.CreateAsync(req);
        return CreatedAtAction(nameof(GetById), new { id = lot.Id }, lot);
    }



    /// <summary>Editar nombre, fecha y notas de un lote</summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateLotRequest req)
    {
        var lot = await _service.UpdateAsync(id, req);
        return lot == null ? NotFound() : Ok(lot);
    }

    /// <summary>Añadir artículos a un lote existente</summary>
    [HttpPost("{id}/items")]
    public async Task<IActionResult> AddItems(int id, [FromBody] AddItemsToLotRequest req)
    {
        var lot = await _service.AddItemsAsync(id, req);
        return lot == null ? NotFound() : Ok(lot);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var deleted = await _service.DeleteAsync(id);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }
}
