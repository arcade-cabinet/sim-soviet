#!/usr/bin/env python3
"""
SimSoviet Asset Pipeline: Kenney → Soviet Retexturer
=====================================================

Blender Python script that converts cheerful Kenney building models into
appropriately grim Soviet concrete structures using AmbientCG PBR textures.

Usage (from Blender scripting console or command line):
    blender --background --python scripts/sovietize_kenney.py

Or load into Blender's Script Editor and run.

Stage 1 of the SimSoviet asset pipeline:
  1. Imports Kenney GLB models
  2. Strips the colormap atlas material
  3. Applies AmbientCG concrete/brick PBR materials (color + normal)
  4. Tints glass/windows to dirty grey-blue
  5. Exports retextured GLBs to public/models/soviet/

Stage 2 (render_sprites.py) takes these GLBs and renders isometric sprites.
"""

import bpy
import os
import json
import sys
from pathlib import Path
from typing import NamedTuple


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Asset source paths (external library)
KENNEY_BASE = Path("/Volumes/home/assets/Kenney/3D assets")
MODULAR_BUILDINGS = KENNEY_BASE / "Modular Buildings/Models/GLB format"
CITY_KIT_SUBURBAN = KENNEY_BASE / "City Kit - Suburban/Models/GLB format"
BUILDING_KIT = KENNEY_BASE / "Building Kit/Models/GLB format"

AMBIENTCG_BASE = Path("/Volumes/home/assets/AmbientCG/Assets/MATERIAL/1K-JPG")

# Output directory (relative to this script's location)
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_ROOT / "public" / "models" / "soviet"


# ---------------------------------------------------------------------------
# Texture Profiles — different concrete looks for building variety
# ---------------------------------------------------------------------------

class TextureProfile(NamedTuple):
    """A PBR texture configuration from AmbientCG."""
    name: str           # AmbientCG material name (e.g., "Concrete022")
    roughness: float    # Override roughness
    uv_scale: float     # UV tiling factor
    normal_strength: float  # Normal map intensity
    tint: tuple         # RGB tint multiplier (1,1,1) = no tint


# Clean panel concrete — standard khrushchyovka residential
CONCRETE_RESIDENTIAL = TextureProfile(
    name="Concrete022",
    roughness=0.88,
    uv_scale=3.0,
    normal_strength=1.2,
    tint=(0.85, 0.85, 0.88),  # Slight cold shift
)

# Weathered industrial concrete
CONCRETE_INDUSTRIAL = TextureProfile(
    name="Concrete024",
    roughness=0.92,
    uv_scale=2.5,
    normal_strength=1.5,
    tint=(0.78, 0.77, 0.75),  # Yellowed/weathered
)

# Dark stained government concrete
CONCRETE_GOVERNMENT = TextureProfile(
    name="Concrete026",
    roughness=0.85,
    uv_scale=4.0,
    normal_strength=1.0,
    tint=(0.72, 0.72, 0.78),  # Cold blue-grey
)

# Light brutalist concrete — Brezhnev-era institutional
CONCRETE_INSTITUTIONAL = TextureProfile(
    name="Concrete015",
    roughness=0.90,
    uv_scale=3.5,
    normal_strength=1.3,
    tint=(0.80, 0.80, 0.82),
)

# Rough construction concrete — unfinished/gulag
CONCRETE_ROUGH = TextureProfile(
    name="Concrete028",
    roughness=0.95,
    uv_scale=2.0,
    normal_strength=2.0,
    tint=(0.70, 0.68, 0.65),  # Dirty brown-grey
)


# ---------------------------------------------------------------------------
# Building Manifest — what to convert and how
# ---------------------------------------------------------------------------

# Maps source GLB filename → (soviet_name, texture_profile, game_role)
BUILDING_MANIFEST = {
    # === MODULAR BUILDINGS: Complete structures ===
    # Apartment towers (панельки / panelki)
    "building-sample-tower-a.glb": ("apartment-tower-a", CONCRETE_RESIDENTIAL, "housing"),
    "building-sample-tower-b.glb": ("apartment-tower-b", CONCRETE_RESIDENTIAL, "housing"),
    "building-sample-tower-c.glb": ("apartment-tower-c", CONCRETE_INSTITUTIONAL, "housing"),
    "building-sample-tower-d.glb": ("apartment-tower-d", CONCRETE_RESIDENTIAL, "housing"),
    # Workers' housing (рабочие дома)
    "building-sample-house-a.glb": ("workers-house-a", CONCRETE_RESIDENTIAL, "housing"),
    "building-sample-house-b.glb": ("workers-house-b", CONCRETE_RESIDENTIAL, "housing"),
    "building-sample-house-c.glb": ("workers-house-c", CONCRETE_INSTITUTIONAL, "housing"),
    # Foundation/utility block
    "building-block.glb": ("concrete-block", CONCRETE_ROUGH, "utility"),

    # === MODULAR BUILDINGS: Building pieces (Daggerfall-style snapping) ===
    "building-window.glb": ("wall-window", CONCRETE_RESIDENTIAL, "modular"),
    "building-window-sill.glb": ("wall-window-sill", CONCRETE_RESIDENTIAL, "modular"),
    "building-window-wide.glb": ("wall-window-wide", CONCRETE_RESIDENTIAL, "modular"),
    "building-window-wide-sill.glb": ("wall-window-wide-sill", CONCRETE_RESIDENTIAL, "modular"),
    "building-window-balcony.glb": ("wall-balcony", CONCRETE_RESIDENTIAL, "modular"),
    "building-windows.glb": ("wall-windows", CONCRETE_RESIDENTIAL, "modular"),
    "building-windows-sills.glb": ("wall-windows-sills", CONCRETE_RESIDENTIAL, "modular"),
    "building-door.glb": ("wall-door", CONCRETE_RESIDENTIAL, "modular"),
    "building-door-window.glb": ("wall-door-window", CONCRETE_RESIDENTIAL, "modular"),
    "building-corner.glb": ("wall-corner", CONCRETE_RESIDENTIAL, "modular"),
    "building-corner-window.glb": ("wall-corner-window", CONCRETE_RESIDENTIAL, "modular"),
    "building-corner-bottom.glb": ("wall-corner-bottom", CONCRETE_RESIDENTIAL, "modular"),
    "building-corner-top.glb": ("wall-corner-top", CONCRETE_RESIDENTIAL, "modular"),
    "building-steps-wide.glb": ("steps-wide", CONCRETE_INSTITUTIONAL, "modular"),
    "building-steps-narrow.glb": ("steps-narrow", CONCRETE_INSTITUTIONAL, "modular"),

    # Flat roofs (Soviet buildings are ALL flat roofs)
    "roof-flat-center.glb": ("roof-flat", CONCRETE_ROUGH, "modular"),
    "roof-flat-border-corner.glb": ("roof-border-corner", CONCRETE_ROUGH, "modular"),
    "roof-flat-border-straight.glb": ("roof-border-straight", CONCRETE_ROUGH, "modular"),
    "roof-flat-border-side.glb": ("roof-border-side", CONCRETE_ROUGH, "modular"),
    "roof-flat-top.glb": ("roof-top", CONCRETE_ROUGH, "modular"),
    "roof-flat-detail-a.glb": ("roof-vent-a", CONCRETE_ROUGH, "modular"),
    "roof-flat-detail-b.glb": ("roof-vent-b", CONCRETE_ROUGH, "modular"),
    "roof-flat-detail-c.glb": ("roof-antenna", CONCRETE_ROUGH, "modular"),
    "roof-flat-detail-d.glb": ("roof-pipe", CONCRETE_ROUGH, "modular"),
}

# City Kit Suburban — whole buildings to repurpose
SUBURBAN_MANIFEST = {
    # Repurpose suburban houses as various Soviet buildings
    "building-type-a.glb": ("government-hq", CONCRETE_GOVERNMENT, "government"),
    "building-type-b.glb": ("ministry-office", CONCRETE_GOVERNMENT, "government"),
    "building-type-c.glb": ("factory-office", CONCRETE_INDUSTRIAL, "industry"),
    "building-type-d.glb": ("workers-club", CONCRETE_INSTITUTIONAL, "culture"),
    "building-type-e.glb": ("polyclinic", CONCRETE_INSTITUTIONAL, "services"),
    "building-type-f.glb": ("school", CONCRETE_INSTITUTIONAL, "services"),
    "building-type-g.glb": ("power-station", CONCRETE_INDUSTRIAL, "power"),
    "building-type-h.glb": ("warehouse", CONCRETE_INDUSTRIAL, "industry"),
    "building-type-i.glb": ("guard-post", CONCRETE_ROUGH, "military"),
    "building-type-j.glb": ("barracks", CONCRETE_ROUGH, "military"),
    "building-type-k.glb": ("collective-farm-hq", CONCRETE_ROUGH, "agriculture"),
    "building-type-l.glb": ("bread-factory", CONCRETE_INDUSTRIAL, "industry"),
    "building-type-m.glb": ("radio-station", CONCRETE_GOVERNMENT, "propaganda"),
    "building-type-n.glb": ("kgb-office", CONCRETE_GOVERNMENT, "government"),
    "building-type-o.glb": ("post-office", CONCRETE_INSTITUTIONAL, "services"),
    "building-type-p.glb": ("hospital", CONCRETE_INSTITUTIONAL, "services"),
    "building-type-q.glb": ("train-station", CONCRETE_INDUSTRIAL, "transport"),
    "building-type-r.glb": ("fire-station", CONCRETE_INDUSTRIAL, "services"),
    "building-type-s.glb": ("vodka-distillery", CONCRETE_INDUSTRIAL, "industry"),
    "building-type-t.glb": ("cultural-palace", CONCRETE_GOVERNMENT, "culture"),
    "building-type-u.glb": ("gulag-admin", CONCRETE_ROUGH, "military"),
    # Environment
    "fence.glb": ("fence", CONCRETE_ROUGH, "environment"),
    "fence-low.glb": ("fence-low", CONCRETE_ROUGH, "environment"),
}


# ---------------------------------------------------------------------------
# Material Creation
# ---------------------------------------------------------------------------

def create_soviet_material(profile: TextureProfile, mat_name: str) -> bpy.types.Material:
    """Create a PBR material from AmbientCG textures with Soviet tinting."""
    mat = bpy.data.materials.new(name=mat_name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    # Output
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (500, 0)

    # Principled BSDF
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (100, 0)
    bsdf.inputs["Roughness"].default_value = profile.roughness
    bsdf.inputs["Specular IOR Level"].default_value = 0.25
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    # UV Mapping with tiling
    tex_coord = nodes.new("ShaderNodeTexCoord")
    tex_coord.location = (-800, 0)
    mapping = nodes.new("ShaderNodeMapping")
    mapping.location = (-600, 0)
    s = profile.uv_scale
    mapping.inputs["Scale"].default_value = (s, s, s)
    links.new(tex_coord.outputs["UV"], mapping.inputs["Vector"])

    # Resolve texture paths
    tex_dir = AMBIENTCG_BASE / profile.name
    color_path = tex_dir / f"{profile.name}_1K-JPG_Color.jpg"
    normal_path = tex_dir / f"{profile.name}_1K-JPG_NormalGL.jpg"

    # Color texture + tint
    if color_path.exists():
        color_tex = nodes.new("ShaderNodeTexImage")
        color_tex.location = (-300, 200)
        color_tex.image = bpy.data.images.load(str(color_path))
        links.new(mapping.outputs["Vector"], color_tex.inputs["Vector"])

        # Apply Soviet tint via MixRGB
        if profile.tint != (1, 1, 1):
            tint_node = nodes.new("ShaderNodeMix")
            tint_node.data_type = "RGBA"
            tint_node.location = (-50, 200)
            tint_node.blend_type = "MULTIPLY"
            tint_node.inputs["Factor"].default_value = 1.0
            tint_node.inputs[7].default_value = (*profile.tint, 1.0)  # B input (color)
            links.new(color_tex.outputs["Color"], tint_node.inputs[6])  # A input
            links.new(tint_node.outputs[2], bsdf.inputs["Base Color"])  # Result
        else:
            links.new(color_tex.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        # Fallback: flat Soviet grey
        bsdf.inputs["Base Color"].default_value = (0.35, 0.35, 0.38, 1.0)
        print(f"  WARNING: Color texture not found: {color_path}")

    # Normal map
    if normal_path.exists():
        normal_tex = nodes.new("ShaderNodeTexImage")
        normal_tex.location = (-300, -200)
        normal_img = bpy.data.images.load(str(normal_path))
        normal_img.colorspace_settings.name = "Non-Color"
        normal_tex.image = normal_img
        links.new(mapping.outputs["Vector"], normal_tex.inputs["Vector"])

        normal_map = nodes.new("ShaderNodeNormalMap")
        normal_map.location = (-50, -200)
        normal_map.inputs["Strength"].default_value = profile.normal_strength
        links.new(normal_tex.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

    return mat


def create_soviet_glass_material() -> bpy.types.Material:
    """Create a dirty Soviet window glass material — grey-blue, low transparency."""
    mat = bpy.data.materials.new(name="soviet_glass")
    mat.use_nodes = True
    mat.blend_method = "BLEND" if hasattr(mat, "blend_method") else None
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (300, 0)

    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    # Dirty grey-blue glass
    bsdf.inputs["Base Color"].default_value = (0.25, 0.28, 0.35, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.3
    bsdf.inputs["Specular IOR Level"].default_value = 0.8
    bsdf.inputs["Alpha"].default_value = 0.7
    bsdf.inputs["Metallic"].default_value = 0.1
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    return mat


# ---------------------------------------------------------------------------
# Pipeline Core
# ---------------------------------------------------------------------------

def clear_scene():
    """Remove ALL objects and data blocks from the scene.

    The original version only removed objects with users==0, which left
    stale mesh data blocks from previous imports leaking into subsequent
    GLB exports. This version force-removes everything.
    """
    # Delete all objects
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    # Force-remove ALL data blocks (not just orphans)
    # Must snapshot the list first since we're mutating during iteration
    for block in list(bpy.data.meshes):
        bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        bpy.data.materials.remove(block)
    for block in list(bpy.data.images):
        bpy.data.images.remove(block)
    for block in list(bpy.data.cameras):
        bpy.data.cameras.remove(block)
    for block in list(bpy.data.lights):
        bpy.data.lights.remove(block)

    # Belt and suspenders: purge any remaining orphan data recursively
    bpy.ops.outliner.orphans_purge(do_recursive=True)


def sovietize_model(
    source_glb: Path,
    output_glb: Path,
    profile: TextureProfile,
    soviet_name: str,
) -> bool:
    """Import a Kenney GLB, retexture it, and export as a Soviet building."""
    clear_scene()

    # Import GLB
    if not source_glb.exists():
        print(f"  SKIP: Source not found: {source_glb}")
        return False

    bpy.ops.import_scene.gltf(filepath=str(source_glb))

    # Create materials
    concrete_mat = create_soviet_material(profile, f"soviet_{soviet_name}")
    glass_mat = create_soviet_glass_material()

    # Replace materials on all mesh objects
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue

        for i, slot in enumerate(obj.material_slots):
            if slot.material is None:
                continue

            old_name = slot.material.name.lower()

            # Kenney models use "colormap" as material name
            # Glass/window pieces might have different names
            if "glass" in old_name or "window" in old_name:
                slot.material = glass_mat
            else:
                slot.material = concrete_mat

    # Export
    output_glb.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output_glb),
        export_format="GLB",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_materials="EXPORT",
        export_image_format="JPEG",
        export_jpeg_quality=85,
    )

    # Get file size
    size_kb = output_glb.stat().st_size / 1024
    print(f"  OK: {soviet_name} ({size_kb:.0f} KB)")
    return True


def run_pipeline():
    """Execute the full retexturing pipeline."""
    print("=" * 60)
    print("SimSoviet Asset Pipeline: Kenney -> Soviet Retexturer")
    print("=" * 60)

    results = {"success": [], "failed": [], "skipped": []}
    manifest_data = {}

    # Process Modular Buildings
    print("\n--- Modular Buildings ---")
    for filename, (soviet_name, profile, role) in BUILDING_MANIFEST.items():
        source = MODULAR_BUILDINGS / filename
        output = OUTPUT_DIR / f"{soviet_name}.glb"
        print(f"  Processing: {filename} -> {soviet_name}")

        if sovietize_model(source, output, profile, soviet_name):
            results["success"].append(soviet_name)
            manifest_data[soviet_name] = {
                "file": f"models/soviet/{soviet_name}.glb",
                "source": filename,
                "role": role,
                "texture": profile.name,
            }
        else:
            results["failed"].append(soviet_name)

    # Process City Kit Suburban
    print("\n--- City Kit Suburban ---")
    for filename, (soviet_name, profile, role) in SUBURBAN_MANIFEST.items():
        source = CITY_KIT_SUBURBAN / filename
        output = OUTPUT_DIR / f"{soviet_name}.glb"
        print(f"  Processing: {filename} -> {soviet_name}")

        if sovietize_model(source, output, profile, soviet_name):
            results["success"].append(soviet_name)
            manifest_data[soviet_name] = {
                "file": f"models/soviet/{soviet_name}.glb",
                "source": filename,
                "role": role,
                "texture": profile.name,
            }
        else:
            results["skipped"].append(soviet_name)

    # Write asset manifest for BabylonJS to consume
    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, "w") as f:
        json.dump(
            {
                "version": "1.0.0",
                "generator": "sovietize_kenney.py",
                "assets": manifest_data,
                "roles": {
                    "housing": [k for k, v in manifest_data.items() if v["role"] == "housing"],
                    "government": [k for k, v in manifest_data.items() if v["role"] == "government"],
                    "industry": [k for k, v in manifest_data.items() if v["role"] == "industry"],
                    "services": [k for k, v in manifest_data.items() if v["role"] == "services"],
                    "military": [k for k, v in manifest_data.items() if v["role"] == "military"],
                    "culture": [k for k, v in manifest_data.items() if v["role"] == "culture"],
                    "power": [k for k, v in manifest_data.items() if v["role"] == "power"],
                    "agriculture": [k for k, v in manifest_data.items() if v["role"] == "agriculture"],
                    "propaganda": [k for k, v in manifest_data.items() if v["role"] == "propaganda"],
                    "transport": [k for k, v in manifest_data.items() if v["role"] == "transport"],
                    "modular": [k for k, v in manifest_data.items() if v["role"] == "modular"],
                    "utility": [k for k, v in manifest_data.items() if v["role"] == "utility"],
                    "environment": [k for k, v in manifest_data.items() if v["role"] == "environment"],
                },
            },
            f,
            indent=2,
        )

    # Summary
    print("\n" + "=" * 60)
    print("Pipeline Complete")
    print(f"  Success: {len(results['success'])}")
    print(f"  Failed:  {len(results['failed'])}")
    print(f"  Skipped: {len(results['skipped'])}")
    print(f"  Manifest: {manifest_path}")
    print("=" * 60)

    return results


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    run_pipeline()
