#!/usr/bin/env python3
"""
SimSoviet Asset Pipeline Stage 2: GLB -> Isometric Sprite Renderer
==================================================================

Renders sovietized GLB models as isometric (2:1 dimetric) sprite PNGs
for the Canvas 2D game engine. Produces transparent PNGs matching the
SimCity 2000 / classic isometric viewing angle.

This is Stage 2 of the asset pipeline:
  Stage 1: sovietize_kenney.py  (Kenney GLB -> Soviet retextured GLB)
  Stage 2: render_sprites.py    (Soviet GLB -> Isometric sprite PNG)

Usage:
    # Render all complete buildings (skip modular pieces)
    blender --background --python scripts/render_sprites.py

    # Render a single building (for testing)
    blender --background --python scripts/render_sprites.py -- --only power-station

    # Use EEVEE instead of Cycles (faster, requires GPU/display)
    blender --background --python scripts/render_sprites.py -- --engine eevee

Output:
    app/public/sprites/soviet/*.png          Transparent isometric sprite PNGs
    app/public/sprites/soviet/manifest.json  Sprite metadata (dimensions, anchor points)
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
MODEL_DIR = PROJECT_ROOT / "public" / "models" / "soviet"
SPRITE_DIR = PROJECT_ROOT / "app" / "public" / "sprites" / "soviet"
MANIFEST_PATH = MODEL_DIR / "manifest.json"

# Camera: 2:1 dimetric projection (SimCity 2000 / classic isometric)
#   X = 60 deg  ->  30 deg from horizontal (the "tilt")
#   Z = 45 deg  ->  diamond orientation (looking at the SW corner)
#
# In this projection, a unit square on the ground plane projects to a
# diamond exactly 2x wide as it is tall — matching the POC's 64x32 tiles.
CAM_ROTATION = Euler((math.radians(60), 0, math.radians(45)), 'XYZ')

# Scale: pixels per Blender unit in the final render.
# PPU 80 produces ~130px tall sprites for a 1-unit cube, which is good
# for retina displays when the game tile is 64px wide at 1x.
PIXELS_PER_UNIT = 80

# Padding around the model in the rendered frame (1.0 = no padding)
FRAME_PADDING = 1.25

# Roles that should be rendered as sprites (skip modular assembly pieces)
SKIP_ROLES = {"modular"}


# ---------------------------------------------------------------------------
# CLI argument parsing (Blender passes custom args after --)
# ---------------------------------------------------------------------------

def parse_args():
    """Parse CLI args after Blender's -- separator."""
    args = {"only": None, "engine": "cycles"}

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
            else:
                i += 1

    return args


# ---------------------------------------------------------------------------
# Scene management
# ---------------------------------------------------------------------------

def clear_scene():
    """Remove all objects and orphan data blocks from the Blender scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    for collection in [bpy.data.meshes, bpy.data.materials, bpy.data.images,
                       bpy.data.cameras, bpy.data.lights, bpy.data.worlds]:
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def get_scene_bounds():
    """Compute world-space axis-aligned bounding box of all mesh objects.

    Returns (min_corner, max_corner) as Vector3 pairs.
    """
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
    """Compute model's 2D extent as seen by the camera.

    Projects all 8 bounding box corners into camera space and returns
    the (width, height) of the enclosing 2D rectangle.

    For an orthographic camera, the projection is simply the model's
    extent in the camera's local X-Y plane.
    """
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
    """Create cold, overcast Soviet lighting.

    Two sun lamps simulate an overcast sky:
      - Key: cold blue-white from upper-left (soft, diffuse)
      - Fill: dim warm bounce from below (ground reflection)

    The world background is dark grey (only affects environment lighting,
    the render itself uses transparent background).
    """
    # Key light — cold, overcast sun
    sun_data = bpy.data.lights.new("soviet_sun", 'SUN')
    sun_data.energy = 3.0
    sun_data.color = (0.85, 0.87, 0.95)   # Cold blue-white
    sun_data.angle = math.radians(30)       # Soft shadow edge
    sun_obj = bpy.data.objects.new("soviet_sun", sun_data)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = Euler((
        math.radians(50),
        math.radians(-15),
        math.radians(30),
    ))

    # Fill light — warm ground bounce
    fill_data = bpy.data.lights.new("fill", 'SUN')
    fill_data.energy = 0.8
    fill_data.color = (0.90, 0.88, 0.82)
    fill_obj = bpy.data.objects.new("fill", fill_data)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = Euler((
        math.radians(130),
        0,
        math.radians(-30),
    ))

    # World — grey Soviet sky (environment lighting only)
    world = bpy.data.worlds.new("soviet_sky")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.12, 0.12, 0.15, 1.0)
    bg.inputs["Strength"].default_value = 0.5
    bpy.context.scene.world = world


# ---------------------------------------------------------------------------
# Render engine configuration
# ---------------------------------------------------------------------------

def configure_render(engine="cycles"):
    """Configure render engine and output format.

    Cycles (default): Reliable in headless/background mode on all platforms.
        Uses CPU with denoising for clean results in ~64 samples.
    EEVEE: Faster but requires GPU and may fail in headless mode.
    """
    scene = bpy.context.scene

    # Transparent background — the game draws its own ground tiles
    scene.render.film_transparent = True

    # PNG with alpha channel
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 15

    if engine == "eevee":
        # EEVEE (Blender 4.x = BLENDER_EEVEE_NEXT)
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
        scene.eevee.taa_render_samples = 64
    else:
        # Cycles — works headless, CPU-only for reliability
        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'CPU'
        scene.cycles.samples = 64
        scene.cycles.use_denoising = True
        scene.cycles.denoiser = 'OPENIMAGEDENOISE'


# ---------------------------------------------------------------------------
# Auto-crop
# ---------------------------------------------------------------------------

def auto_crop_png(image_path, anchor_x, anchor_y):
    """Trim transparent pixels from a rendered PNG sprite.

    Reads the image back via Blender's API, finds the content bounding box
    using numpy, crops it, saves back, and returns adjusted anchor + dims.

    Blender stores pixels bottom-to-top (row 0 = bottom of image), while
    PNG files and screen coordinates are top-to-bottom. The coordinate
    conversions account for this.

    Returns (anchor_x, anchor_y, width, height) in PNG coordinates (top-left origin).
    """
    img = bpy.data.images.load(str(image_path))
    w, h = img.size

    # Blender pixel array: flat RGBA floats, bottom-to-top row order
    pixels = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)

    # Find rows/columns with any visible content
    alpha = pixels[:, :, 3]
    rows_mask = np.any(alpha > 0.01, axis=1)
    cols_mask = np.any(alpha > 0.01, axis=0)

    if not np.any(rows_mask):
        # Fully transparent — nothing to crop
        bpy.data.images.remove(img)
        return anchor_x, anchor_y, w, h

    # Bounding box in Blender's bottom-to-top row space
    rmin = int(np.argmax(rows_mask))
    rmax = int(h - 1 - np.argmax(rows_mask[::-1]))
    cmin = int(np.argmax(cols_mask))
    cmax = int(w - 1 - np.argmax(cols_mask[::-1]))

    # 2px padding to prevent edge aliasing artifacts
    pad = 2
    rmin = max(0, rmin - pad)
    rmax = min(h - 1, rmax + pad)
    cmin = max(0, cmin - pad)
    cmax = min(w - 1, cmax + pad)

    # Crop the pixel buffer (still in bottom-to-top order)
    cropped = pixels[rmin:rmax + 1, cmin:cmax + 1, :].copy()
    crop_h, crop_w = cropped.shape[:2]

    # Save cropped image (Blender expects bottom-to-top pixel data)
    new_img = bpy.data.images.new("cropped", crop_w, crop_h, alpha=True)
    new_img.pixels[:] = cropped.flatten().tolist()
    new_img.filepath_raw = str(image_path)
    new_img.file_format = 'PNG'
    new_img.save()

    # Adjust anchor from pre-crop PNG coords to post-crop PNG coords
    #
    # Coordinate math:
    #   PNG row = (h - 1) - blender_row  (flips vertical axis)
    #   anchor_y is in PNG coords (top = 0)
    #   anchor's blender_row = (h - 1) - anchor_y
    #   After cropping blender rows [rmin..rmax]:
    #     new_blender_row = old_blender_row - rmin
    #     new_anchor_y = (crop_h - 1) - new_blender_row
    anchor_blender_row = (h - 1) - anchor_y
    new_blender_row = anchor_blender_row - rmin
    new_anchor_y = (crop_h - 1) - new_blender_row
    new_anchor_x = anchor_x - cmin

    # Cleanup
    bpy.data.images.remove(img)
    bpy.data.images.remove(new_img)

    return int(new_anchor_x), int(new_anchor_y), crop_w, crop_h


# ---------------------------------------------------------------------------
# Single sprite rendering
# ---------------------------------------------------------------------------

def filter_to_source_mesh(source_filename):
    """Remove stale meshes left over from Stage 1 export bug.

    The sovietize_kenney.py pipeline had a clear_scene() issue where
    mesh data blocks from earlier models persisted into later GLB exports.
    This function keeps only the mesh(es) matching the expected source
    filename and deletes everything else.

    Args:
        source_filename: Original Kenney filename, e.g. "building-type-g.glb"
    """
    expected_stem = Path(source_filename).stem  # e.g. "building-type-g"

    to_delete = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        # Keep meshes whose name starts with the expected stem
        # (compound models may have .001, .002 suffixes)
        if not obj.name.startswith(expected_stem):
            to_delete.append(obj)

    if to_delete:
        for obj in to_delete:
            bpy.data.objects.remove(obj, do_unlink=True)
        # Clean orphan mesh data
        for block in list(bpy.data.meshes):
            if block.users == 0:
                bpy.data.meshes.remove(block)


def render_single_sprite(glb_path, output_path, engine="cycles", source_filename=None):
    """Import a sovietized GLB and render it as an isometric sprite.

    Pipeline:
      1. Import GLB, filter to correct mesh (Stage 1 bug workaround)
      2. Create orthographic camera at 2:1 dimetric angle
      3. Frame the model (compute projected extent, set ortho_scale)
      4. Setup lighting
      5. Render to transparent PNG
      6. Compute anchor point (tile base center in image space)
      7. Auto-crop transparent margins

    Returns dict with sprite metadata, or None on failure.
    """
    clear_scene()

    # 1. Import model
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    # Filter out stale meshes from Stage 1 export bug
    if source_filename:
        filter_to_source_mesh(source_filename)

    min_co, max_co = get_scene_bounds()
    if min_co.x == float('inf'):
        print(f"    SKIP: No mesh objects in {glb_path.name}")
        return None

    center = (min_co + max_co) / 2
    size = max_co - min_co

    # 2. Create orthographic camera at dimetric angle
    cam_data = bpy.data.cameras.new("iso_cam")
    cam_data.type = 'ORTHO'
    cam_obj = bpy.data.objects.new("iso_cam", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    cam_obj.rotation_euler = CAM_ROTATION

    # Position camera aimed at model center, pulled back along forward axis.
    # Distance doesn't matter for ortho — it just needs to be far enough
    # that the model is within the near/far clip planes.
    bpy.context.view_layer.update()
    forward = cam_obj.matrix_world.to_quaternion() @ Vector((0, 0, -1))
    cam_obj.location = center - forward * 50
    bpy.context.view_layer.update()

    # 3. Frame the model
    proj_w, proj_h = compute_projected_extent(min_co, max_co, cam_obj)

    padded_h = proj_h * FRAME_PADDING
    padded_w = proj_w * FRAME_PADDING
    cam_data.ortho_scale = padded_h

    # Resolution: proportional to model's projected size at our target PPU
    aspect = padded_w / padded_h if padded_h > 0.001 else 1.0
    res_y = max(64, round(padded_h * PIXELS_PER_UNIT))
    res_x = max(64, round(res_y * aspect))
    # Ensure even dimensions (some encoders prefer this)
    res_x += res_x % 2
    res_y += res_y % 2

    scene = bpy.context.scene
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100

    # 4. Lighting
    setup_lighting()

    # 5. Render
    configure_render(engine)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)

    # 6. Compute anchor point
    # The anchor is where the model's base center (ground-level center of the
    # tile footprint) projects in the output image. This is the point that
    # gets aligned to the tile position when drawing on the 2D canvas:
    #   ctx.drawImage(sprite, screenX - anchor_x, screenY - anchor_y)
    base_center = Vector((center.x, center.y, min_co.z))
    ndc = world_to_camera_view(scene, cam_obj, base_center)
    anchor_x = round(ndc.x * res_x)
    anchor_y = round((1.0 - ndc.y) * res_y)  # Flip Y: NDC bottom=0, PNG top=0

    # 7. Auto-crop
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
        "model_size": {
            "x": round(float(size.x), 3),
            "y": round(float(size.y), 3),
            "z": round(float(size.z), 3),
        },
    }


# ---------------------------------------------------------------------------
# Pipeline orchestration
# ---------------------------------------------------------------------------

def run_sprite_pipeline():
    """Render isometric sprites for all complete buildings in the manifest."""
    args = parse_args()

    print("=" * 60)
    print("SimSoviet Asset Pipeline Stage 2: Isometric Sprite Renderer")
    print(f"  Engine:  {args['engine']}")
    print(f"  PPU:     {PIXELS_PER_UNIT}")
    print(f"  Padding: {FRAME_PADDING}")
    if args["only"]:
        print(f"  Single:  {args['only']}")
    print("=" * 60)

    # Read Stage 1 manifest
    if not MANIFEST_PATH.exists():
        print(f"\nERROR: Manifest not found: {MANIFEST_PATH}")
        print("Run Stage 1 first:")
        print("  blender --background --python scripts/sovietize_kenney.py")
        sys.exit(1)

    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)

    assets = manifest.get("assets", {})
    sprite_data = {}
    results = {"success": [], "failed": [], "skipped": []}

    for name, info in sorted(assets.items()):
        role = info.get("role", "")

        # Skip modular assembly pieces — they're for 3D compositing, not sprites
        if role in SKIP_ROLES:
            results["skipped"].append(name)
            continue

        # Single-model mode for testing
        if args["only"] and name != args["only"]:
            continue

        glb_path = PROJECT_ROOT / "public" / info["file"]
        if not glb_path.exists():
            print(f"\n  [{name}] MISS: {glb_path}")
            results["failed"].append(name)
            continue

        count = len(results["success"]) + len(results["failed"]) + 1
        total = sum(1 for _, v in assets.items()
                    if v.get("role") not in SKIP_ROLES)
        print(f"\n  [{count}/{total}] {name} ({role})")

        try:
            sprite_info = render_single_sprite(
                glb_path,
                output_path=SPRITE_DIR / f"{name}.png",
                engine=args["engine"],
                source_filename=info.get("source"),
            )
            if sprite_info:
                results["success"].append(name)
                sprite_data[name] = {
                    "sprite": f"sprites/soviet/{name}.png",
                    "role": role,
                    **sprite_info,
                }
            else:
                results["failed"].append(name)
        except Exception as e:
            print(f"    FAIL: {e}")
            import traceback
            traceback.print_exc()
            results["failed"].append(name)

    # Write sprite manifest
    sprite_manifest = {
        "version": "1.0.0",
        "generator": "render_sprites.py",
        "camera": {
            "projection": "orthographic",
            "type": "dimetric_2:1",
            "rotation_x_deg": 60,
            "rotation_z_deg": 45,
            "note": "Matches SimCity 2000 / classic isometric viewing angle",
        },
        "scale": {
            "pixels_per_unit": PIXELS_PER_UNIT,
            "frame_padding": FRAME_PADDING,
        },
        "sprites": sprite_data,
        "roles": {},
    }

    # Group sprites by role
    all_roles = sorted(set(v["role"] for v in sprite_data.values()))
    for role in all_roles:
        sprite_manifest["roles"][role] = sorted(
            k for k, v in sprite_data.items() if v["role"] == role
        )

    sprite_manifest_path = SPRITE_DIR / "manifest.json"
    sprite_manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(sprite_manifest_path, "w") as f:
        json.dump(sprite_manifest, f, indent=2)

    # Summary
    print("\n" + "=" * 60)
    print("Sprite Rendering Complete")
    print(f"  Rendered:  {len(results['success'])} sprites")
    print(f"  Failed:    {len(results['failed'])}")
    print(f"  Skipped:   {len(results['skipped'])} (modular pieces)")
    print(f"  Output:    {SPRITE_DIR}/")
    print(f"  Manifest:  {sprite_manifest_path}")
    print("=" * 60)

    if results["failed"]:
        print("\n  Failed models:")
        for name in results["failed"]:
            print(f"    - {name}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    run_sprite_pipeline()
