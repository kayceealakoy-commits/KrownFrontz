"""
Batch-render grillz product previews onto the dental-arch base.

Usage:
  blender --background assets/blender/dental_arch_base.blend \\
    --python scripts/blender_render_previews.py -- --all

  blender --background assets/blender/dental_arch_base.blend \\
    --python scripts/blender_render_previews.py -- --id canine
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = Path(__file__).resolve().parent
OUT_DIR = ROOT / "assets" / "products"
MANIFEST = OUT_DIR / "manifest.json"

if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from grillz_catalog_specs import PRODUCT_SPECS, get_spec  # noqa: E402


def parse_args() -> tuple[str | None, bool]:
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    product_id = None
    do_all = False
    if "--all" in argv:
        do_all = True
    if "--id" in argv:
        product_id = argv[argv.index("--id") + 1]
    return product_id, do_all


def clear_grillz() -> None:
    coll = bpy.data.collections.get("Grillz")
    if coll is None:
        coll = bpy.data.collections.new("Grillz")
        bpy.context.scene.collection.children.link(coll)
    for obj in list(coll.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    # Also remove orphan grillz meshes
    for obj in list(bpy.data.objects):
        if obj.name.startswith("Grillz_") or obj.name.startswith("Cutout_") or obj.name.startswith("Bar_") or obj.name.startswith("Stone_") or obj.name.startswith("Fang_"):
            bpy.data.objects.remove(obj, do_unlink=True)


def link_to_grillz(obj: bpy.types.Object) -> None:
    coll = bpy.data.collections.get("Grillz")
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)


def ensure_materials() -> None:
    """Create or refresh grillz materials."""

    def upsert(name: str, props: dict) -> bpy.types.Material:
        m = bpy.data.materials.get(name)
        if m is None:
            m = bpy.data.materials.new(name)
            m.use_nodes = True
        nodes = m.node_tree.nodes
        links = m.node_tree.links
        bsdf = nodes.get("Principled BSDF")
        if bsdf is None:
            nodes.clear()
            out = nodes.new("ShaderNodeOutputMaterial")
            bsdf = nodes.new("ShaderNodeBsdfPrincipled")
            bsdf.name = "Principled BSDF"
            links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
        for key, value in props.items():
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = value
        return m

    upsert(
        "GrillzGold",
        {
            "Base Color": (1.0, 0.72, 0.18, 1.0),
            "Metallic": 1.0,
            "Roughness": 0.1,
            "Coat Weight": 0.4,
            "Coat Roughness": 0.06,
        },
    )
    upsert(
        "GrillzSilver",
        {
            "Base Color": (0.88, 0.90, 0.93, 1.0),
            "Metallic": 1.0,
            "Roughness": 0.12,
            "Coat Weight": 0.35,
        },
    )
    upsert(
        "GrillzIced",
        {
            "Base Color": (0.92, 0.93, 0.96, 1.0),
            "Metallic": 1.0,
            "Roughness": 0.08,
            "Coat Weight": 0.45,
        },
    )
    upsert(
        "Crystal",
        {
            "Base Color": (0.95, 0.97, 1.0, 1.0),
            "Metallic": 0.0,
            "Roughness": 0.03,
            "Transmission Weight": 0.92,
            "IOR": 2.4,
        },
    )


def mat(name: str) -> bpy.types.Material:
    ensure_materials()
    m = bpy.data.materials.get(name)
    if m is None:
        raise RuntimeError(f"Missing material {name}")
    return m


def finish_material(finish: str) -> bpy.types.Material:
    if finish == "silver":
        return mat("GrillzSilver")
    if finish == "iced":
        return mat("GrillzIced")
    return mat("GrillzGold")


def tooth_object(label: str) -> bpy.types.Object | None:
    """Tooth locator empty (preferred) or legacy mesh proxy."""
    return bpy.data.objects.get(f"Tooth_{label}")


def tooth_volume(label: str) -> bpy.types.Object | None:
    return bpy.data.objects.get(f"Tooth_{label}_Vol")


def dental_cast_for_label(label: str) -> bpy.types.Object | None:
    if label.startswith("U"):
        return bpy.data.objects.get("DentalCast_Upper") or bpy.data.objects.get("DentalCast")
    return bpy.data.objects.get("DentalCast_Lower") or bpy.data.objects.get("DentalCast")


def duplicate_as_cap(
    tooth: bpy.types.Object,
    name: str,
    material: bpy.types.Material,
    scale: float = 1.04,
) -> bpy.types.Object | None:
    """
    Thin metal shell sitting ON the real cast tooth surface.

    Builds a subdivided crown blank, shrinkwraps onto DentalCast_Upper/Lower,
    then solidifies outward.
    """
    label = tooth.name.replace("Tooth_", "")
    cast = dental_cast_for_label(label)
    if cast is None:
        print(f"  warn: no cast for {label}")
        return None

    loc = tooth.matrix_world.translation.copy()
    num = int(label[-1]) if label[-1].isdigit() else 4
    radius = {1: 0.038, 2: 0.032, 3: 0.036, 4: 0.036, 5: 0.036, 6: 0.048, 7: 0.044}.get(num, 0.036)
    radius *= scale

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=radius, location=loc)
    cap = bpy.context.active_object
    cap.name = name
    # Flatten into a facial plaque
    cap.scale = Vector((1.15, 0.55, 1.25))
    cap.rotation_euler = tooth.rotation_euler.copy()
    link_to_grillz(cap)

    bpy.ops.object.select_all(action="DESELECT")
    cap.select_set(True)
    bpy.context.view_layer.objects.active = cap
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Start slightly in front of the facial surface
    cap.location = loc + Vector((0.0, -0.006, 0.0))

    bpy.ops.object.modifier_add(type="SHRINKWRAP")
    wrap = cap.modifiers["Shrinkwrap"]
    wrap.target = cast
    wrap.wrap_method = "NEAREST_SURFACEPOINT"
    wrap.offset = 0.0022
    bpy.ops.object.modifier_apply(modifier=wrap.name)

    if cap.data is None or len(cap.data.polygons) < 4:
        print(f"  warn: empty cap for {label}")
        bpy.data.objects.remove(cap, do_unlink=True)
        return None

    bpy.ops.object.modifier_add(type="SOLIDIFY")
    solid = cap.modifiers["Solidify"]
    solid.thickness = 0.0055
    solid.offset = 1.0
    bpy.ops.object.modifier_apply(modifier=solid.name)

    cap.location = Vector(cap.location) + Vector((0.0, -0.0025, 0.0))
    cap.data.materials.clear()
    cap.data.materials.append(material)
    for poly in cap.data.polygons:
        poly.use_smooth = True
    return cap


def make_cutout_shape(kind: str, location: Vector, size: float, normal_yaw: float) -> bpy.types.Object:
    if kind == "heart":
        # Approximate heart with two spheres + cone boolean — use scaled icosphere pair merged
        bpy.ops.mesh.primitive_ico_sphere_add(radius=size * 0.55, location=location + Vector((-size * 0.28, 0, size * 0.15)))
        a = bpy.context.active_object
        a.name = "Cutout_HeartA"
        bpy.ops.mesh.primitive_ico_sphere_add(radius=size * 0.55, location=location + Vector((size * 0.28, 0, size * 0.15)))
        b = bpy.context.active_object
        b.name = "Cutout_HeartB"
        bpy.ops.mesh.primitive_cone_add(radius1=size * 0.75, depth=size * 0.9, location=location + Vector((0, 0, -size * 0.25)))
        c = bpy.context.active_object
        c.name = "Cutout_HeartC"
        c.rotation_euler = Euler((math.radians(180), 0, 0), "XYZ")
        # Join
        bpy.ops.object.select_all(action="DESELECT")
        for o in (a, b, c):
            o.select_set(True)
        bpy.context.view_layer.objects.active = a
        bpy.ops.object.join()
        cutter = a
        cutter.name = "Cutout_Tmp"
    elif kind == "star":
        bpy.ops.mesh.primitive_cylinder_add(radius=size * 0.55, depth=size * 2.2, location=location)
        cutter = bpy.context.active_object
        cutter.name = "Cutout_Tmp"
        # Squash into flat star-ish diamond by scaling unevenly + rotate
        cutter.scale = (1.0, 0.35, 1.0)
        bpy.ops.object.transform_apply(scale=True)
        # Add rotated copy for star points
        bpy.ops.object.duplicate()
        tip = bpy.context.active_object
        tip.rotation_euler = Euler((0, 0, math.radians(45)), "XYZ")
        bpy.ops.object.select_all(action="DESELECT")
        cutter.select_set(True)
        tip.select_set(True)
        bpy.context.view_layer.objects.active = cutter
        bpy.ops.object.join()
    else:
        # window rectangle
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
        cutter = bpy.context.active_object
        cutter.name = "Cutout_Tmp"
        cutter.scale = (size * 0.9, size * 2.5, size * 1.15)

    cutter.rotation_euler = Euler((0.0, 0.0, normal_yaw), "XYZ")
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    link_to_grillz(cutter)
    return cutter


def apply_boolean_difference(cap: bpy.types.Object, cutter: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = cap
    bpy.ops.object.modifier_add(type="BOOLEAN")
    mod = cap.modifiers[-1]
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    # Prefer exact if available
    if hasattr(mod, "solver"):
        try:
            mod.solver = "EXACT"
        except TypeError:
            pass
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def add_vampire_fang(tooth: bpy.types.Object, material: bpy.types.Material, upper: bool) -> None:
    loc = tooth.matrix_world.translation
    tip_z = loc.z + (-0.07 if upper else 0.07)
    bpy.ops.mesh.primitive_cone_add(
        radius1=0.018,
        depth=0.07,
        location=(loc.x, loc.y - 0.01, tip_z),
    )
    fang = bpy.context.active_object
    fang.name = f"Fang_{tooth.name}"
    fang.rotation_euler = Euler((math.radians(180 if upper else 0), 0, 0), "XYZ")
    fang.data.materials.append(material)
    link_to_grillz(fang)


def add_bar(a: bpy.types.Object, b: bpy.types.Object, material: bpy.types.Material) -> None:
    mid = (a.matrix_world.translation + b.matrix_world.translation) * 0.5
    mid.y -= 0.01
    direction = b.matrix_world.translation - a.matrix_world.translation
    length = direction.length * 0.85
    bpy.ops.mesh.primitive_cylinder_add(radius=0.008, depth=max(length, 0.02), location=mid)
    bar = bpy.context.active_object
    bar.name = f"Bar_{a.name}_{b.name}"
    bar.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    bar.data.materials.append(material)
    link_to_grillz(bar)


def add_dust(tooth: bpy.types.Object, crystal: bpy.types.Material, count: int = 18) -> None:
    import random

    rng = random.Random(hash(tooth.name) & 0xFFFFFFFF)
    base = tooth.matrix_world.translation
    for i in range(count):
        offset = Vector(
            (
                (rng.random() - 0.5) * 0.05,
                -0.02 - rng.random() * 0.01,
                (rng.random() - 0.5) * 0.06,
            )
        )
        bpy.ops.mesh.primitive_ico_sphere_add(
            radius=0.003 + rng.random() * 0.003,
            location=base + offset,
        )
        stone = bpy.context.active_object
        stone.name = f"Stone_Dust_{tooth.name}_{i}"
        stone.data.materials.append(crystal)
        link_to_grillz(stone)


def add_iced_stones(tooth: bpy.types.Object, crystal: bpy.types.Material, count: int = 8) -> None:
    import random

    rng = random.Random((hash(tooth.name) ^ 0xABC) & 0xFFFFFFFF)
    base = tooth.matrix_world.translation
    for i in range(count):
        offset = Vector(
            (
                (rng.random() - 0.5) * 0.04,
                -0.025 - rng.random() * 0.008,
                (rng.random() - 0.5) * 0.05,
            )
        )
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=1,
            radius=0.006 + rng.random() * 0.004,
            location=base + offset,
        )
        stone = bpy.context.active_object
        stone.name = f"Stone_Ice_{tooth.name}_{i}"
        stone.data.materials.append(crystal)
        link_to_grillz(stone)


def build_product(product_id: str) -> None:
    spec = get_spec(product_id)
    material = finish_material(spec["finish"])
    crystal = mat("Crystal")
    style = spec["style"]
    cutouts = set(spec.get("cutout_teeth") or [])
    inlay = set(spec.get("inlay_teeth") or [])
    caps: dict[str, bpy.types.Object] = {}

    for label in spec["teeth"]:
        tooth = tooth_object(label)
        if tooth is None:
            print(f"  warn: missing tooth {label}")
            continue
        cap_scale = 1.035 if label in inlay else 1.06
        cap = duplicate_as_cap(tooth, f"Grillz_{product_id}_{label}", material, scale=cap_scale)
        if cap is None:
            continue
        caps[label] = cap

        use_cutout = label in cutouts or style in ("window", "heart", "star") and label in cutouts
        if not use_cutout and style in ("window", "heart", "star") and not cutouts:
            use_cutout = True
        if use_cutout or (style in ("window", "heart", "star") and label in cutouts):
            kind = "window"
            if style == "heart" or (style == "mixed" and label in cutouts and "heart" in product_id):
                kind = "heart"
            if style == "star":
                kind = "star"
            if "heart" in product_id and label in cutouts:
                kind = "heart"
            yaw = tooth.rotation_euler.z
            cut_loc = tooth.matrix_world.translation + Vector((0.0, -0.04, 0.0))
            size = 0.018 if kind != "window" else 0.022
            cutter = make_cutout_shape(kind, cut_loc, size, yaw)
            apply_boolean_difference(cap, cutter)

        if spec.get("vampire") and label.endswith("3"):
            add_vampire_fang(tooth, material, upper=label.startswith("U"))
        if spec.get("dust"):
            add_dust(tooth, crystal)
        if spec.get("iced"):
            add_iced_stones(tooth, crystal)

    if spec.get("bar") and len(caps) >= 2:
        labels = list(caps.keys())
        canines = [t for t in labels if t.endswith("3")]
        laterals = [t for t in labels if t.endswith("2")]
        if canines and laterals:
            add_bar(caps[canines[0]], caps[laterals[0]], material)
            if len(canines) > 1 and len(laterals) > 1:
                add_bar(caps[canines[1]], caps[laterals[1]], material)
        else:
            add_bar(caps[labels[0]], caps[labels[1]], material)


def render_product(product_id: str) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{product_id}.webp"
    scene = bpy.context.scene
    scene.render.filepath = str(out.with_suffix(""))
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 90
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.engine = "BLENDER_EEVEE"
    if hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 48
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.exposure = -1.0
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out}")
    return out


def main() -> None:
    product_id, do_all = parse_args()
    if not do_all and not product_id:
        do_all = True

    ids = list(PRODUCT_SPECS.keys()) if do_all else [product_id]
    manifest: dict[str, str] = {}
    if MANIFEST.exists():
        try:
            manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            manifest = {}

    for pid in ids:
        print(f"=== {pid} ===")
        clear_grillz()
        build_product(pid)
        render_product(pid)
        manifest[pid] = f"assets/products/{pid}.webp"

    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Done. {len(ids)} products. Manifest -> {MANIFEST}")


if __name__ == "__main__":
    main()
