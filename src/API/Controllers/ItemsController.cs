using Microsoft.AspNetCore.Mvc;
using RetroGameTracker.DTOs;
using RetroGameTracker.Resources;
using RetroGameTracker.Services;

namespace RetroGameTracker.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ItemsController : ControllerBase
{
    private readonly ItemService _service;

    public ItemsController(ItemService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? platform,
        [FromQuery] string? type,
        [FromQuery] string? condition,
        [FromQuery] bool? isSold,
        [FromQuery] bool? isCollection,
        [FromQuery] string? search,
        [FromQuery] string? tags)   // ← coma-separados: "regalo,reservado"
    {
        var tagList = string.IsNullOrEmpty(tags)
            ? null
            : tags.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(t => t.Trim()).ToList();

        var items = await _service.GetAllAsync(platform, type, condition, isSold, isCollection, search, tagList);
        return Ok(items);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _service.GetByIdAsync(id);
        return item == null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateItemRequest req)
    {
        var item = await _service.CreateAsync(req);
        return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateItemRequest req)
    {
        var item = await _service.UpdateAsync(id, req);
        return item == null ? NotFound() : Ok(item);
    }

    [HttpPost("{id}/sell")]
    public async Task<IActionResult> Sell(int id, [FromBody] SellItemRequest req)
    {
        var item = await _service.SellAsync(id, req);
        return item == null ? NotFound(new { error = AppText.Get("backend.items.notFoundOrSold") }) : Ok(item);
    }

    [HttpPost("{id}/unsell")]
    public async Task<IActionResult> Unsell(int id)
    {
        var item = await _service.UnsellAsync(id);
        return item == null ? NotFound(new { error = AppText.Get("backend.items.notFoundOrNotSold") }) : Ok(item);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _service.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
