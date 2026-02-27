using Microsoft.AspNetCore.Mvc;
using RetroGameTracker.DTOs;
using RetroGameTracker.Services;

namespace RetroGameTracker.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ItemsController : ControllerBase
{
    private readonly ItemService _service;

    public ItemsController(ItemService service) => _service = service;

    /// <summary>Listado de artículos con filtros opcionales</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? platform,
        [FromQuery] string? type,
        [FromQuery] string? condition,
        [FromQuery] bool? isSold,
        [FromQuery] bool? isCollection,
        [FromQuery] string? search)
    {
        var items = await _service.GetAllAsync(platform, type, condition, isSold, isCollection, search);
        return Ok(items);
    }

    /// <summary>Obtener un artículo por ID</summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _service.GetByIdAsync(id);
        return item == null ? NotFound() : Ok(item);
    }

    /// <summary>Crear artículo individual (sin lote)</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateItemRequest req)
    {
        var item = await _service.CreateAsync(req);
        return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
    }

    /// <summary>Actualizar artículo</summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateItemRequest req)
    {
        var item = await _service.UpdateAsync(id, req);
        return item == null ? NotFound() : Ok(item);
    }

    /// <summary>Marcar artículo como vendido</summary>
    [HttpPost("{id}/sell")]
    public async Task<IActionResult> Sell(int id, [FromBody] SellItemRequest req)
    {
        var item = await _service.SellAsync(id, req);
        return item == null ? NotFound(new { error = "Artículo no encontrado o ya vendido" }) : Ok(item);
    }

    /// <summary>Deshacer venta de un artículo</summary>
    [HttpPost("{id}/unsell")]
    public async Task<IActionResult> Unsell(int id)
    {
        var item = await _service.UnsellAsync(id);
        return item == null ? NotFound(new { error = "Artículo no encontrado o no está vendido" }) : Ok(item);
    }

    /// <summary>Eliminar artículo</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _service.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
