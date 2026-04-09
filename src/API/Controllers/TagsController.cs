using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RetroGameTracker.Data;
using RetroGameTracker.DTOs;
using RetroGameTracker.Resources;

namespace RetroGameTracker.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TagsController : ControllerBase
{
    private readonly AppDbContext _db;

    public TagsController(AppDbContext db) => _db = db;

    /// <summary>Devuelve todos los tags con su conteo de artículos</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var tags = await _db.Tags
            .Select(t => new { t.Id, t.Name, Count = t.ItemTags.Count })
            .ToListAsync();

        var result = tags
            .OrderBy(t => t.Name)
            .Select(t => new TagDto(t.Id, t.Name, t.Count))
            .ToList();

        return Ok(result);
    }

    /// <summary>Crea un tag nuevo (sin artículos asignados)</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] RenameTagRequest req)
    {
        var normalized = req.Name.Trim().ToLower();
        if (string.IsNullOrEmpty(normalized))
            return BadRequest(new { error = AppText.Get("backend.tags.emptyName") });

        if (await _db.Tags.AnyAsync(t => t.Name == normalized))
            return Conflict(new { error = AppText.Format("backend.tags.duplicateName", normalized) });

        var tag = new RetroGameTracker.Models.Tag { Name = normalized };
        _db.Tags.Add(tag);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new TagDto(tag.Id, tag.Name, 0));
    }

    /// <summary>Renombra un tag existente</summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Rename(int id, [FromBody] RenameTagRequest req)
    {
        var tag = await _db.Tags.FindAsync(id);
        if (tag == null) return NotFound();

        var normalized = req.Name.Trim().ToLower();
        if (string.IsNullOrEmpty(normalized))
            return BadRequest(new { error = AppText.Get("backend.tags.emptyName") });

        if (await _db.Tags.AnyAsync(t => t.Name == normalized && t.Id != id))
            return Conflict(new { error = AppText.Format("backend.tags.duplicateName", normalized) });

        tag.Name = normalized;
        await _db.SaveChangesAsync();
        return Ok(new TagDto(tag.Id, tag.Name, tag.ItemTags.Count));
    }

    /// <summary>Elimina un tag y lo desvincula de todos los artículos</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var tag = await _db.Tags.FindAsync(id);
        if (tag == null) return NotFound();
        _db.Tags.Remove(tag);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record RenameTagRequest(string Name);
