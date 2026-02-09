#!/usr/bin/env python3
"""
SimSoviet Asset Pipeline Stage 3: Hex Tile Sprite Renderer
============================================================

Renders Kenney Hexagon Kit tiles as isometric (2:1 dimetric) sprite PNGs
with Soviet-themed colormap variants for seasonal terrain rendering.

Uses the same camera angle and lighting as the building sprites (Stage 2)
so tiles and buildings composite correctly on the Canvas 2D game board.

This is Stage 3 of the asset pipeline:
  Stage 1: sovietize_kenney.py  (Kenney GLB -> Soviet retextured GLB)
  Stage 2: render_sprites.py    (Soviet GLB -> Isometric building sprites)
  Stage 3: render_hex_tiles.py  (Kenney Hex -> Soviet seasonal tile sprites)

Usage:
    # Render all hex tiles in all season variants
    blender --background --python scripts/render_hex_tiles.py

    # Render only winter variant
    blender --background --python scripts/render_hex_tiles.py -- --season winter

    # Render a single tile (for testing)
    blender --background --python scripts/render_hex_tiles.py -- --only grass

    # Use EEVEE instead of Cycles
    blender --background --python scripts/render_hex_tiles.py -- --engine eevee

Output:
    app/public/sprites/soviet/tiles/winter/*.png
    app/public/sprites/soviet/tiles/mud/*.png
    app/public/sprites/soviet/tiles/summer/*.png
    app/public/sprites/soviet/tiles/manifest.json
"""

import bpy
import math
import json
import sys
import numpy as np
from pathlib import Path
from mathutils import Vector, Euler
from bpy_extras.object_utils import world_to_camera_view


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_ROOT / "app" / "public" / "sprites" / "soviet" / "tiles"

# Kenney Hexagon Kit source
HEX_KIT_DIR = Path("/Volumes/home/assets/Kenney/3D assets/Hexagon Kit/Models/GLB format")

# Camera: same 2:1 dimetric as building sprites
CAM_ROTATION = Euler((math.radians(60), 0, math.radians(45)), 'XYZ')
PIXELS_PER_UNIT = 80
FRAME_PADDING = 1.25

# Hex tiles to render (skip building/unit models — we use our own Soviet buildings)
TILE_CATEGORIES = {
    "terrain": [
        "grass", "dirt", "stone", "sand", "water",
    ],
    "terrain_feature": [
        "grass-forest", "grass-hill",
        "stone-hill", "stone-mountain", "stone-rocks",
        "sand-desert", "sand-rocks",
        "water-island", "water-rocks",
        "dirt-lumber",
    ],
    "path": [
        "path-straight", "path-corner", "path-corner-sharp",
        "path-crossing", "path-end", "path-start",
        "path-square", "path-square-end",
        "path-intersectionA", "path-intersectionB",
        "path-intersectionC", "path-intersectionD",
        "path-intersectionE", "path-intersectionF",
        "path-intersectionG", "path-intersectionH",
    ],
    "river": [
        "river-straight", "river-corner", "river-corner-sharp",
        "river-crossing", "river-end", "river-start",
        "river-intersectionA", "river-intersectionB",
        "river-intersectionC", "river-intersectionD",
        "river-intersectionE", "river-intersectionF",
        "river-intersectionG", "river-intersectionH",
    ],
    "structure": [
        "bridge",
    ],
}

# Flatten for iteration
ALL_TILES = []
TILE_TO_CATEGORY = {}
for cat, tiles in TILE_CATEGORIES.items():
    for t in tiles:
        ALL_TILES.append(t)
        TILE_TO_CATEGORY[t] = cat


# ---------------------------------------------------------------------------
# Soviet Colormap Generation
# ---------------------------------------------------------------------------

def create_soviet_colormap(original_pixels, variant="winter"):
    """Remap Kenney's colormap palette to Soviet-themed colors.

    The Kenney hex tiles all share a single 512x512 UV-mapped colormap.
    By remapping the colors in this texture, all tiles adopt the new
    palette simultaneously. Each variant targets a different season:

      winter — Frozen tundra. Desaturated blue-gray, dark, high contrast.
               The default Soviet look: everything is cold and bleak.

      mud    — Rasputitsa (spring/autumn mud season). Warm dark browns,
               low contrast. Roads become impassable.

      summer — Brief Soviet summer. Muted greens with gray undertone.
               Slightly brighter than winter but still depressing.

    Args:
        original_pixels: numpy array (H, W, 4) of original RGBA floats [0-1]
        variant: "winter", "mud", or "summer"

    Returns:
        numpy array (H, W, 4) of remapped RGBA floats
    """
    result = original_pixels.copy()
    rgb = result[:, :, :3].copy()

    # Luminance for desaturation
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]

    # Black pixel mask (unused palette regions)
    black_mask = (original_pixels[:, :, 0] < 0.01) & \
                 (original_pixels[:, :, 1] < 0.01) & \
                 (original_pixels[:, :, 2] < 0.01)

    if variant == "winter":
        # Frozen tundra: desaturate hard, shift cold, darken
        sat = 0.12
        for c in range(3):
            rgb[:, :, c] = lum + sat * (rgb[:, :, c] - lum)
        rgb[:, :, 0] *= 0.82   # less red
        rgb[:, :, 1] *= 0.86   # less green
        rgb[:, :, 2] *= 1.05   # slight blue boost
        rgb *= 0.65             # darken
        # Contrast
        mid = 0.30
        rgb = mid + 1.35 * (rgb - mid)

    elif variant == "mud":
        # Rasputitsa: warm brown, low contrast, muddy
        sat = 0.18
        for c in range(3):
            rgb[:, :, c] = lum + sat * (rgb[:, :, c] - lum)
        rgb[:, :, 0] *= 1.08   # warm shift
        rgb[:, :, 1] *= 0.92
        rgb[:, :, 2] *= 0.78   # less blue (warm)
        rgb *= 0.60             # darken
        # Low contrast (everything muddy)
        mid = 0.28
        rgb = mid + 1.1 * (rgb - mid)

    elif variant == "summer":
        # Brief Soviet summer: muted green-gray
        sat = 0.30
        for c in range(3):
            rgb[:, :, c] = lum + sat * (rgb[:, :, c] - lum)
        rgb[:, :, 0] *= 0.88
        rgb[:, :, 1] *= 0.95   # keep slight green
        rgb[:, :, 2] *= 0.90
        rgb *= 0.72
        mid = 0.32
        rgb = mid + 1.25 * (rgb - mid)

    # Restore black regions
    rgb[black_mask] = 0
    rgb = np.clip(rgb, 0, 1)

    result[:, :, :3] = rgb
    return result


def load_and_remap_colormap(variant="winter"):
    """Load the original Kenney colormap and create a Soviet variant.

    Returns a bpy.data.images instance with the remapped pixels.
    """
    # Find the packed colormap from any loaded hex GLB
    original = None
    for img in bpy.data.images:
        if 'colormap' in img.name.lower() and img.packed_file:
            original = img
            break

    if not original:
        # Load a hex tile to get the packed colormap
        test_path = HEX_KIT_DIR / "grass.glb"
        bpy.ops.import_scene.gltf(filepath=str(test_path))
        for img in bpy.data.images:
            if 'colormap' in img.name.lower():
                original = img
                break
        # Clean up test import
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)

    if not original:
        raise RuntimeError("Could not find Kenney colormap texture")

    w, h = original.size
    pixels = np.array(original.pixels[:]).reshape(h, w, 4)

    remapped = create_soviet_colormap(pixels, variant)

    img_name = f"soviet_{variant}_colormap"
    # Remove existing if re-running
    existing = bpy.data.images.get(img_name)
    if existing:
        bpy.data.images.remove(existing)

    new_img = bpy.data.images.new(img_name, w, h, alpha=True)
    new_img.pixels[:] = remapped.flatten().tolist()
    new_img.pack()

    return new_img


# ---------------------------------------------------------------------------
# CLI argument parsing
# ---------------------------------------------------------------------------

def parse_args():
    args = {"only": None, "engine": "cycles", "season": None}

    if "--" in sys.argv:
        custom = sys.argv[sys.argv.index("--") + 1:]
        i = 0
        while i < len(custom):
            if custom[i] == "--only" and i + 1 < len(custom):
                args["only"] = custom[i + 1]
                i += 2
            elif custom[i] == "--engine" and i + 1 < len(custom):
                args["engine"] = custom[i + 1].lower()
                i += 2
            elif custom[i] == "--season" and i + 1 < len(custom):
                args["season"] = custom[i + 1].lower()
                i += 2
            else:
                i += 1

    return args


# ---------------------------------------------------------------------------
# Scene management (shared with render_sprites.py)
# ---------------------------------------------------------------------------

def clear_scene():
    """Remove all objects and orphan data — preserving colormap images."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    for collection in [bpy.data.meshes, bpy.data.cameras, bpy.data.lights,
                       bpy.data.worlds]:
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)

    # Clean materials but DON'T clean images (we keep the colormaps)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)


def get_scene_bounds():
    min_co = Vector((float('inf'),) * 3)
    max_co = Vector((float('-inf'),) * 3)

    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        for corner in obj.bound_box:
            world_co = obj.matrix_world @ Vector(corner)
            for i in range(3):
                min_co[i] = min(min_co[i], world_co[i])
                max_co[i] = max(max_co[i], world_co[i])

    return min_co, max_co


def compute_projected_extent(min_co, max_co, cam_obj):
    cam_inv = cam_obj.matrix_world.inverted()

    corners = [
        Vector((x, y, z))
        for x in (min_co.x, max_co.x)
        for y in (min_co.y, max_co.y)
        for z in (min_co.z, max_co.z)
    ]

    cam_corners = [cam_inv @ c for c in corners]

    xs = [c.x for c in cam_corners]
    ys = [c.y for c in cam_corners]

    return (max(xs) - min(xs), max(ys) - min(ys))


# ---------------------------------------------------------------------------
# Lighting
# ---------------------------------------------------------------------------

def setup_lighting():
    """Cold, overcast Soviet lighting — same as building sprites."""
    sun_data = bpy.data.lights.new("soviet_sun", 'SUN')
    sun_data.energy = 3.0
    sun_data.color = (0.85, 0.87, 0.95)
    sun_data.angle = math.radians(30)
    sun_obj = bpy.data.objects.new("soviet_sun", sun_data)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = Euler((
        math.radians(50), math.radians(-15), math.radians(30),
    ))

    fill_data = bpy.data.lights.new("fill", 'SUN')
    fill_data.energy = 0.8
    fill_data.color = (0.90, 0.88, 0.82)
    fill_obj = bpy.data.objects.new("fill", fill_data)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = Euler((
        math.radians(130), 0, math.radians(-30),
    ))

    world = bpy.data.worlds.new("soviet_sky")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.12, 0.12, 0.15, 1.0)
    bg.inputs["Strength"].default_value = 0.5
    bpy.context.scene.world = world


# ---------------------------------------------------------------------------
# Render configuration
# ---------------------------------------------------------------------------

def configure_render(engine="cycles"):
    scene = bpy.context.scene
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 15

    if engine == "eevee":
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
        scene.eevee.taa_render_samples = 64
    else:
        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'CPU'
        scene.cycles.samples = 64
        scene.cycles.use_denoising = True
        scene.cycles.denoiser = 'OPENIMAGEDENOISE'


# ---------------------------------------------------------------------------
# Auto-crop (same logic as render_sprites.py)
# ---------------------------------------------------------------------------

def auto_crop_png(image_path, anchor_x, anchor_y):
    """Trim transparent pixels, adjust anchor point."""
    img = bpy.data.images.load(str(image_path))
    w, h = img.size

    pixels = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    alpha = pixels[:, :, 3]
    rows_mask = np.any(alpha > 0.01, axis=1)
    cols_mask = np.any(alpha > 0.01, axis=0)

    if not np.any(rows_mask):
        bpy.data.images.remove(img)
        return anchor_x, anchor_y, w, h

    rmin = int(np.argmax(rows_mask))
    rmax = int(h - 1 - np.argmax(rows_mask[::-1]))
    cmin = int(np.argmax(cols_mask))
    cmax = int(w - 1 - np.argmax(cols_mask[::-1]))

    pad = 2
    rmin = max(0, rmin - pad)
    rmax = min(h - 1, rmax + pad)
    cmin = max(0, cmin - pad)
    cmax = min(w - 1, cmax + pad)

    cropped = pixels[rmin:rmax + 1, cmin:cmax + 1, :].copy()
    crop_h, crop_w = cropped.shape[:2]

    new_img = bpy.data.images.new("cropped", crop_w, crop_h, alpha=True)
    new_img.pixels[:] = cropped.flatten().tolist()
    new_img.filepath_raw = str(image_path)
    new_img.file_format = 'PNG'
    new_img.save()

    anchor_blender_row = (h - 1) - anchor_y
    new_blender_row = anchor_blender_row - rmin
    new_anchor_y = (crop_h - 1) - new_blender_row
    new_anchor_x = anchor_x - cmin

    bpy.data.images.remove(img)
    bpy.data.images.remove(new_img)

    return int(new_anchor_x), int(new_anchor_y), crop_w, crop_h


# ---------------------------------------------------------------------------
# Single tile rendering
# ---------------------------------------------------------------------------

def apply_soviet_colormap(soviet_cm):
    """Swap all colormap textures in the scene to the Soviet variant."""
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                if 'colormap' in node.image.name.lower() or 'soviet' not in node.image.name.lower():
                    node.image = soviet_cm


def render_single_tile(tile_name, soviet_cm, output_path, engine="cycles"):
    """Import a hex tile GLB, apply Soviet colormap, render as sprite.

    Returns dict with sprite metadata, or None on failure.
    """
    clear_scene()

    glb_path = HEX_KIT_DIR / f"{tile_name}.glb"
    if not glb_path.exists():
        print(f"    MISS: {glb_path}")
        return None

    # Import
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    # Apply Soviet colormap
    apply_soviet_colormap(soviet_cm)

    min_co, max_co = get_scene_bounds()
    if min_co.x == float('inf'):
        print(f"    SKIP: No mesh in {tile_name}")
        return None

    center = (min_co + max_co) / 2
    size = max_co - min_co

    # Camera
    cam_data = bpy.data.cameras.new("iso_cam")
    cam_data.type = 'ORTHO'
    cam_obj = bpy.data.objects.new("iso_cam", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    cam_obj.rotation_euler = CAM_ROTATION

    bpy.context.view_layer.update()
    forward = cam_obj.matrix_world.to_quaternion() @ Vector((0, 0, -1))
    cam_obj.location = center - forward * 50
    bpy.context.view_layer.update()

    # Frame
    proj_w, proj_h = compute_projected_extent(min_co, max_co, cam_obj)
    padded_h = proj_h * FRAME_PADDING
    padded_w = proj_w * FRAME_PADDING
    cam_data.ortho_scale = padded_h

    aspect = padded_w / padded_h if padded_h > 0.001 else 1.0
    res_y = max(64, round(padded_h * PIXELS_PER_UNIT))
    res_x = max(64, round(res_y * aspect))
    res_x += res_x % 2
    res_y += res_y % 2

    scene = bpy.context.scene
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100

    # Lighting & render config
    setup_lighting()
    configure_render(engine)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)

    # Anchor: hex center at ground level (z=0)
    # For hex tiles, the center of the hexagon at z=0 is the anchor
    base_center = Vector((0, 0, 0))
    ndc = world_to_camera_view(scene, cam_obj, base_center)
    anchor_x = round(ndc.x * res_x)
    anchor_y = round((1.0 - ndc.y) * res_y)

    # Auto-crop
    anchor_x, anchor_y, final_w, final_h = auto_crop_png(
        output_path, anchor_x, anchor_y
    )

    file_kb = output_path.stat().st_size / 1024
    print(f"    OK: {final_w}x{final_h}  anchor=({anchor_x},{anchor_y})  {file_kb:.0f} KB")

    return {
        "width": final_w,
        "height": final_h,
        "anchor_x": anchor_x,
        "anchor_y": anchor_y,
        "hex_size": {
            "x": round(float(size.x), 4),
            "y": round(float(size.y), 4),
            "z": round(float(size.z), 4),
        },
    }


# ---------------------------------------------------------------------------
# Pipeline orchestration
# ---------------------------------------------------------------------------

def run_hex_tile_pipeline():
    args = parse_args()
    seasons = [args["season"]] if args["season"] else ["winter", "mud", "summer"]

    print("=" * 60)
    print("SimSoviet Asset Pipeline Stage 3: Hex Tile Renderer")
    print(f"  Engine:   {args['engine']}")
    print(f"  Seasons:  {', '.join(seasons)}")
    print(f"  PPU:      {PIXELS_PER_UNIT}")
    print(f"  Source:   {HEX_KIT_DIR}")
    if args["only"]:
        print(f"  Single:   {args['only']}")
    print("=" * 60)

    if not HEX_KIT_DIR.exists():
        print(f"\nERROR: Kenney Hexagon Kit not found: {HEX_KIT_DIR}")
        print("Expected at /Volumes/home/assets/Kenney/3D assets/Hexagon Kit/")
        sys.exit(1)

    # Pre-generate all Soviet colormaps
    print("\nGenerating Soviet colormaps...")
    soviet_colormaps = {}
    for season in seasons:
        cm = load_and_remap_colormap(season)
        soviet_colormaps[season] = cm
        print(f"  {season}: {cm.size[0]}x{cm.size[1]}")

    # Filter tiles
    tiles_to_render = ALL_TILES
    if args["only"]:
        if args["only"] in ALL_TILES:
            tiles_to_render = [args["only"]]
        else:
            print(f"\nERROR: Unknown tile '{args['only']}'")
            print(f"Available tiles: {', '.join(ALL_TILES)}")
            sys.exit(1)

    total = len(tiles_to_render) * len(seasons)
    sprite_data = {}  # season -> tile_name -> metadata
    results = {"success": 0, "failed": 0, "skipped": 0}

    count = 0
    for season in seasons:
        print(f"\n{'─' * 40}")
        print(f"Season: {season.upper()}")
        print(f"{'─' * 40}")

        soviet_cm = soviet_colormaps[season]
        season_sprites = {}

        for tile_name in tiles_to_render:
            count += 1
            category = TILE_TO_CATEGORY.get(tile_name, "unknown")
            print(f"\n  [{count}/{total}] {tile_name} ({category})")

            output_path = OUTPUT_DIR / season / f"{tile_name}.png"

            try:
                info = render_single_tile(
                    tile_name, soviet_cm, output_path, args["engine"]
                )
                if info:
                    results["success"] += 1
                    season_sprites[tile_name] = {
                        "sprite": f"sprites/soviet/tiles/{season}/{tile_name}.png",
                        "category": category,
                        **info,
                    }
                else:
                    results["failed"] += 1
            except Exception as e:
                print(f"    FAIL: {e}")
                import traceback
                traceback.print_exc()
                results["failed"] += 1

        sprite_data[season] = season_sprites

    # Write manifest
    manifest = {
        "version": "1.0.0",
        "generator": "render_hex_tiles.py",
        "camera": {
            "projection": "orthographic",
            "type": "dimetric_2:1",
            "rotation_x_deg": 60,
            "rotation_z_deg": 45,
        },
        "scale": {
            "pixels_per_unit": PIXELS_PER_UNIT,
            "frame_padding": FRAME_PADDING,
        },
        "hex_geometry": {
            "flat_to_flat": 1.0,
            "pointy_to_pointy": 1.1547,
            "column_spacing": 0.75,
            "row_spacing": 0.5774,
            "orientation": "flat_top",
            "note": "Offset coordinates: odd columns shift +half row",
        },
        "seasons": {},
        "categories": TILE_CATEGORIES,
    }

    for season, sprites in sprite_data.items():
        manifest["seasons"][season] = sprites

    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    # Summary
    print(f"\n{'=' * 60}")
    print("Hex Tile Rendering Complete")
    print(f"  Rendered:  {results['success']} sprites")
    print(f"  Failed:    {results['failed']}")
    print(f"  Seasons:   {', '.join(seasons)}")
    print(f"  Output:    {OUTPUT_DIR}/")
    print(f"  Manifest:  {manifest_path}")
    print(f"{'=' * 60}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    run_hex_tile_pipeline()
