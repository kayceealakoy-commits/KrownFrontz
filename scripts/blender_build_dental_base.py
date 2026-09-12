"""
Build K9-style open-bite dental base from dropped upper+lower casts.

Expects:
  assets/blender/source/upper_cast.stl
  assets/blender/source/lower_cast.stl

Creates DentalCast_Upper / DentalCast_Lower, studio lighting, and
Tooth_* locator empties calibrated on the real arches for grillz fitting.

Usage:
  blender --background --python scripts/blender_build_dental_base.py
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "blender" / "source"
UPPER_STL = SOURCE / "upper_cast.stl"
LOWER_STL = SOURCE / "lower_cast.stl"
OUT_BLEND = ROOT / "assets" / "blender" / "dental_arch_base.blend"

UPPER_ORDER = [
    "UR7", "UR6", "UR5", "UR4", "UR3", "UR2", "UR1",
    "UL1", "UL2", "UL3", "UL4", "UL5", "UL6", "UL7",
]
LOWER_ORDER = [t.replace("U", "L") for t in UPPER_ORDER]

# Arch samples in final scene space (anterior faces -Y, open bite).
PROXY_UPPER = {"radius_x": 0.42, "radius_y": 0.28, "z": 0.10, "y_bias": -0.02}
PROXY_LOWER = {"radius_x": 0.40, "radius_y": 0.26, "z": -0.12, "y_bias": 0.00}


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.lights,
        bpy.data.cameras,
        bpy.data.collections,
        bpy.data.worlds,
        bpy.data.images,
    ):
        for item in list(block):
            block.remove(item)


def ensure_collection(name: str) -> bpy.types.Collection:
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    return coll


def link_object(obj: bpy.types.Object, coll: bpy.types.Collection) -> None:
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)


def make_principled(name: str) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.name = "Principled BSDF"
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def set_bsdf(mat: bpy.types.Material, **kwargs) -> None:
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if not bsdf:
        return
    for key, value in kwargs.items():
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = value


def world_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    xs = [c.x for c in coords]
    ys = [c.y for c in coords]
    zs = [c.z for c in coords]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def import_stl(path: Path, name: str) -> bpy.types.Object:
    if not path.exists():
        raise FileNotFoundError(f"Missing cast file: {path}")
    before = set(bpy.data.objects)
    if hasattr(bpy.ops.wm, "stl_import"):
        bpy.ops.wm.stl_import(filepath=str(path))
    else:
        bpy.ops.import_mesh.stl(filepath=str(path))
    imported = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    if not imported:
        raise RuntimeError(f"STL import produced no mesh: {path}")
    obj = imported[0]
    obj.name = name
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    obj.location = (0.0, 0.0, 0.0)
    return obj


def apply_object_rotation(obj: bpy.types.Object, rx: float = 0.0, ry: float = 0.0, rz: float = 0.0) -> None:
    obj.rotation_euler = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), "XYZ")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    obj.location = (0.0, 0.0, 0.0)


def prepare_cast(obj: bpy.types.Object, plaster: bpy.types.Material, *, flip_hang: bool) -> bpy.types.Object:
    """Scale mm→scene, face camera (-Y). If flip_hang, upper teeth point down."""
    mn, mx = world_bounds(obj)
    width = max(mx.x - mn.x, 1e-6)
    scale = 1.05 / width
    obj.scale = (scale, scale, scale)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Source STLs: anterior ≈ +Y, occlusal ≈ +Z.
    if flip_hang:
        # rx180 → anterior -Y and occlusal -Z (hanging upper)
        apply_object_rotation(obj, rx=180)
    else:
        # rz180 → anterior -Y, occlusal stays +Z
        apply_object_rotation(obj, rz=180)

    # Light decimate if very dense
    if len(obj.data.polygons) > 350_000:
        bpy.ops.object.modifier_add(type="DECIMATE")
        obj.modifiers["Decimate"].ratio = 0.5
        bpy.ops.object.modifier_apply(modifier="Decimate")

    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.data.materials.clear()
    obj.data.materials.append(plaster)
    return obj


def arch_sample(i: int, n: int, radius_x: float, radius_y: float, z: float) -> tuple[Vector, float]:
    t = -1.0 + 2.0 * i / (n - 1)
    x = t * radius_x
    y = -radius_y + (t * t) * radius_y * 0.45
    yaw = t * math.radians(24)
    return Vector((x, y, z)), yaw


def create_tooth_locator(
    name: str,
    loc: Vector,
    yaw: float,
    upper: bool,
    coll: bpy.types.Collection,
) -> bpy.types.Object:
    """Empty used as tooth target. Grillz script reads location/rotation."""
    tip = Vector((0, 0, -1 if upper else 1))
    facial = Vector((math.sin(yaw), -math.cos(yaw), 0.0)).normalized()
    right = tip.cross(facial).normalized()
    facial = right.cross(tip).normalized()
    mat = Matrix(
        (
            (right.x, facial.x, tip.x, loc.x),
            (right.y, facial.y, tip.y, loc.y),
            (right.z, facial.z, tip.z, loc.z),
            (0, 0, 0, 1),
        )
    )

    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = "SPHERE"
    empty.empty_display_size = 0.02
    empty.matrix_world = mat
    empty.hide_render = True
    bpy.context.scene.collection.objects.link(empty)
    link_object(empty, coll)

    num = int(name[-1])
    dims = {
        1: (0.07, 0.06, 0.10),
        2: (0.055, 0.05, 0.09),
        3: (0.06, 0.065, 0.11),
        4: (0.06, 0.07, 0.08),
        5: (0.06, 0.07, 0.08),
        6: (0.09, 0.085, 0.075),
        7: (0.085, 0.08, 0.07),
    }.get(num, (0.06, 0.06, 0.08))

    mesh = bpy.data.meshes.new(name + "_VolMesh")
    # Unit cube centered at origin, scaled via object scale
    import bmesh

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(mesh)
    bm.free()
    proxy = bpy.data.objects.new(name + "_Vol", mesh)
    proxy.matrix_world = mat
    proxy.scale = dims
    proxy.hide_render = True
    proxy.hide_viewport = True
    proxy.display_type = "WIRE"
    bpy.context.scene.collection.objects.link(proxy)
    link_object(proxy, coll)
    return empty


def sample_facial_centers(obj: bpy.types.Object, n: int = 14) -> list[Vector]:
    """Estimate per-tooth facial centers along the arch (camera-facing -Y)."""
    mw = obj.matrix_world
    m3 = mw.to_3x3()
    pts: list[Vector] = []
    for poly in obj.data.polygons:
        nrm = (m3 @ poly.normal).normalized()
        if nrm.y > -0.35:
            continue
        pts.append(mw @ poly.center)
    if not pts:
        return []
    xmin = min(p.x for p in pts)
    xmax = max(p.x for p in pts)
    bins: list[list[Vector]] = [[] for _ in range(n)]
    for p in pts:
        t = 0.0 if xmax == xmin else (p.x - xmin) / (xmax - xmin)
        i = min(n - 1, max(0, int(t * n)))
        bins[i].append(p)
    centers: list[Vector] = []
    for b in bins:
        if not b:
            centers.append(Vector((0.0, 0.0, 0.0)))
            continue
        centers.append(sum(b, Vector()) / len(b))
    return centers


def build_tooth_locators(upper: bpy.types.Object, lower: bpy.types.Object) -> None:
    teeth = ensure_collection("Teeth")
    ensure_collection("Grillz")
    n = len(UPPER_ORDER)

    upper_centers = sample_facial_centers(upper, n)
    lower_centers = sample_facial_centers(lower, n)

    def fallback(i: int, cfg: dict, upper_arch: bool) -> tuple[Vector, float]:
        loc, yaw = arch_sample(i, n, cfg["radius_x"], cfg["radius_y"], cfg["z"])
        loc = Vector((loc.x, loc.y + cfg["y_bias"], loc.z))
        return loc, yaw

    for i, label in enumerate(UPPER_ORDER):
        if upper_centers and upper_centers[i].length_squared > 0:
            loc = upper_centers[i] + Vector((0.0, -0.008, 0.0))
            t = -1.0 + 2.0 * i / (n - 1)
            yaw = t * math.radians(24)
        else:
            loc, yaw = fallback(i, PROXY_UPPER, True)
        create_tooth_locator(f"Tooth_{label}", loc, yaw, True, teeth)

    for i, label in enumerate(LOWER_ORDER):
        if lower_centers and lower_centers[i].length_squared > 0:
            loc = lower_centers[i] + Vector((0.0, -0.008, 0.0))
            t = -1.0 + 2.0 * i / (n - 1)
            yaw = t * math.radians(24)
        else:
            loc, yaw = fallback(i, PROXY_LOWER, False)
        create_tooth_locator(f"Tooth_{label}", loc, yaw, False, teeth)


def setup_studio() -> None:
    studio = ensure_collection("Studio")
    black = make_principled("BackdropBlack")
    set_bsdf(black, **{"Base Color": (0.0, 0.0, 0.0, 1.0), "Roughness": 1.0, "Metallic": 0.0})

    bpy.ops.mesh.primitive_plane_add(size=14.0, location=(0.0, 2.8, 0.1))
    backdrop = bpy.context.active_object
    backdrop.name = "Backdrop"
    backdrop.rotation_euler = Euler((math.radians(90), 0, 0), "XYZ")
    backdrop.data.materials.append(black)
    link_object(backdrop, studio)

    bpy.ops.mesh.primitive_plane_add(size=10.0, location=(0.0, 0.0, -0.9))
    floor = bpy.context.active_object
    floor.name = "Floor"
    floor.data.materials.append(black)
    link_object(floor, studio)

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 60
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (0.0, -1.70, 0.04)
    cam.rotation_euler = (Vector((0.0, 0.02, 0.0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    def add_area(name: str, loc: Vector, energy: float, size: float, color=(1.0, 1.0, 1.0)) -> None:
        data = bpy.data.lights.new(name=name, type="AREA")
        data.energy = energy
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        obj.location = loc
        obj.rotation_euler = (Vector((0.0, 0.0, 0.0)) - loc).to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.collection.objects.link(obj)
        link_object(obj, studio)

    add_area("KeyLight", Vector((0.45, -1.1, 0.5)), 60, 1.0)
    add_area("FillLight", Vector((-0.55, -1.0, 0.2)), 24, 1.3, color=(0.85, 0.9, 1.0))
    add_area("RimLight", Vector((0.2, 0.55, 0.35)), 18, 0.7)


def setup_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 92
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -0.9
    if hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 48
    world = bpy.data.worlds.new("BlackWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.0, 0.0, 0.0, 1.0)
        bg.inputs[1].default_value = 0.0


def make_materials() -> bpy.types.Material:
    plaster = make_principled("PlasterCast")
    set_bsdf(
        plaster,
        **{
            "Base Color": (0.80, 0.79, 0.76, 1.0),
            "Roughness": 0.82,
            "Metallic": 0.0,
            "Specular IOR Level": 0.18,
        },
    )
    for name, props in (
        (
            "GrillzGold",
            {
                "Base Color": (1.0, 0.72, 0.18, 1.0),
                "Metallic": 1.0,
                "Roughness": 0.1,
                "Coat Weight": 0.4,
                "Coat Roughness": 0.06,
            },
        ),
        (
            "GrillzSilver",
            {
                "Base Color": (0.88, 0.90, 0.93, 1.0),
                "Metallic": 1.0,
                "Roughness": 0.12,
                "Coat Weight": 0.35,
            },
        ),
        (
            "GrillzIced",
            {
                "Base Color": (0.92, 0.93, 0.96, 1.0),
                "Metallic": 1.0,
                "Roughness": 0.08,
                "Coat Weight": 0.45,
            },
        ),
        (
            "Crystal",
            {
                "Base Color": (0.95, 0.97, 1.0, 1.0),
                "Metallic": 0.0,
                "Roughness": 0.03,
                "Transmission Weight": 0.92,
                "IOR": 2.4,
            },
        ),
    ):
        m = make_principled(name)
        set_bsdf(m, **props)
        m.use_fake_user = True

    holder = bpy.data.objects.new("MaterialHolder", bpy.data.meshes.new("MaterialHolderMesh"))
    bpy.context.scene.collection.objects.link(holder)
    for mname in ("GrillzGold", "GrillzSilver", "GrillzIced", "Crystal", "PlasterCast"):
        holder.data.materials.append(bpy.data.materials[mname])
    holder.hide_render = True
    holder.hide_viewport = True
    return plaster


def main() -> None:
    clear_scene()
    plaster = make_materials()

    upper = import_stl(UPPER_STL, "DentalCast_Upper")
    lower = import_stl(LOWER_STL, "DentalCast_Lower")
    prepare_cast(upper, plaster, flip_hang=True)
    prepare_cast(lower, plaster, flip_hang=False)

    # Open-bite separation (K9-style parted arches)
    upper.location = (0.0, 0.0, 0.20)
    lower.location = (0.0, 0.02, -0.22)
    upper.rotation_euler = Euler((math.radians(10), 0.0, 0.0), "XYZ")
    lower.rotation_euler = Euler((math.radians(-10), 0.0, 0.0), "XYZ")

    cast_coll = ensure_collection("Cast")
    link_object(upper, cast_coll)
    link_object(lower, cast_coll)

    build_tooth_locators(upper, lower)
    setup_studio()
    setup_render()

    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    umn, umx = world_bounds(upper)
    lmn, lmx = world_bounds(lower)
    print(f"Saved {OUT_BLEND}")
    print(f"Upper bounds {umn} .. {umx}")
    print(f"Lower bounds {lmn} .. {lmx}")


if __name__ == "__main__":
    main()
