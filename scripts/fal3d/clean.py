"""FLT-13: clean a generated GLB for the game. Run inside Blender:

  blender-headless -b --factory-startup --python scripts/fal3d/clean.py -- \
      --in raw.glb --out cleaned.glb --kind hall --tris 5000 --fit 2.3,1.75,2.3 [--rot-y 90] [--stats stats.json]

Steps: import, join, weld and fix normals; bake the texture into per-corner colours; decimate toward the triangle budget; snap every
face to the nearest colour of the game palette (flat shaded, glass faces to their own material); fit to the footprint
(1 unit = 1 tile, pivot at the ground centre, Y up); export a GLB with vertex colours. Meshopt happens after, in Node.
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- arguments
argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


SRC = arg("--in")
DST = arg("--out")
KIND = arg("--kind")
BUDGET = int(arg("--tris", "5000"))
FIT = [float(v) for v in arg("--fit", "2,2,2").split(",")]  # game axes: x width, y height, z depth
ROT_Y_ARG = arg("--rot-y", "0")  # degrees around the game's up axis, or "auto" to put the long side along x
SMOOTH = int(arg("--smooth", "2"))  # majority-vote passes over neighbouring faces' palette colours; 0 keeps the raw snap
LIGHT_W = float(arg("--lw", "0.35"))  # weight of lightness in the palette distance; hue and chroma survive baked shading, lightness does not
EXPOSE = arg("--expose", "auto")  # "auto" lifts the p90 face brightness to cream, undoing shading baked into the texture; "0" leaves it
STATS = arg("--stats")
PALETTE = Path(__file__).with_name("palette.json")

# ---------------------------------------------------------------- colour helpers
srgb_to_lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
lin_to_srgb = lambda c: c * 12.92 if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def hex_to_lin(h):
    h = h.lstrip("#")
    return [srgb_to_lin(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)]


def lin_to_lab(rgb):
    r, g, b = rgb
    x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
    y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
    z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x / 0.95047), f(y), f(z / 1.08883)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


pal = json.loads(PALETTE.read_text())
_kind = pal["kinds"].get(KIND, {"add": [], "drop": []})
entries = [e for e in pal["shared"] if e["name"] not in _kind["drop"]] + _kind["add"]
for e in entries:
    e["lin"] = hex_to_lin(e["hex"])
    e["lab"] = lin_to_lab(e["lin"])
    e["count"] = 0


def nearest(lin):
    lab = lin_to_lab(lin)
    return min(entries, key=lambda e: LIGHT_W * (lab[0] - e["lab"][0]) ** 2 + (lab[1] - e["lab"][1]) ** 2 + (lab[2] - e["lab"][2]) ** 2)


# ---------------------------------------------------------------- import and join
bpy.ops.wm.read_factory_settings(use_empty=True)
if SRC.lower().endswith(".obj"):
    bpy.ops.wm.obj_import(filepath=SRC)  # Hunyuan hands back OBJ + MTL + PNG; Y-up, like glTF
else:
    bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not meshes:
    raise SystemExit("no mesh in " + SRC)
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active


def tri_count(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


raw_tris = tri_count(obj)
raw_verts = len(obj.data.vertices)

# Triangulate, weld.
bm = bmesh.new()
bm.from_mesh(obj.data)
bmesh.ops.triangulate(bm, faces=bm.faces)
bm.to_mesh(obj.data)
bm.free()
dims = obj.dimensions
diag = math.sqrt(sum(d * d for d in dims)) or 1.0
bm = bmesh.new()
bm.from_mesh(obj.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=diag * 1e-5)
# Generated meshes come with some faces wound inside out; point every face outward (FLT-89).
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(obj.data)
bm.free()

# ---------------------------------------------------------------- bake: texture (or vertex colour) to per-corner colours
mesh = obj.data
image = None
base_factor = [1.0, 1.0, 1.0]
for slot in obj.material_slots:
    mat = slot.material
    if not mat or not mat.use_nodes:
        continue
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        base_factor = list(bsdf.inputs["Base Color"].default_value)[:3]
        link = bsdf.inputs["Base Color"].links[0] if bsdf.inputs["Base Color"].links else None
        if link and link.from_node.type == "TEX_IMAGE":
            image = link.from_node.image
            break
        # Sometimes a mix node sits in between; take the first image texture in the tree.
    tex = next((n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)
    if tex:
        image = tex.image
        break

import numpy as np
from mathutils.bvhtree import BVHTree

uv = mesh.uv_layers.active
vcol = mesh.color_attributes.active_color if mesh.color_attributes else None
px = None
if image is not None:
    w, h = image.size
    px = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    # image.pixels is sRGB-encoded for an 8-bit colour texture (its mean matched the PNG's exactly), so linearise it.
    if not image.is_float:
        px[..., :3] = np.where(px[..., :3] <= 0.04045, px[..., :3] / 12.92, ((px[..., :3] + 0.055) / 1.055) ** 2.4)

    def sample(u, v):
        x = min(w - 1, max(0, int((u % 1.0) * w)))
        y = min(h - 1, max(0, int((v % 1.0) * h)))
        return [float(px[y, x, 0]), float(px[y, x, 1]), float(px[y, x, 2])]

# Colour per corner of the *source* mesh, kept as a plain list. Decimation is not trusted to carry colour: collapsing a
# million triangles down to a few thousand smears it, so the final faces sample this source instead (below).
src_col = []
for loop in mesh.loops:
    if uv is not None and px is not None:
        c = sample(*uv.data[loop.index].uv)
    elif vcol is not None:
        src = vcol.data[loop.index].color if vcol.domain == "CORNER" else vcol.data[loop.vertex_index].color
        c = list(src)[:3]
    else:
        c = base_factor
    src_col.append(c)
src_mesh = mesh.copy()
src_obj = bpy.data.objects.new("src", src_mesh)
bpy.context.scene.collection.objects.link(src_obj)
src_bvh = BVHTree.FromObject(src_obj, bpy.context.evaluated_depsgraph_get())
src_tris = [tuple(p.loop_indices) for p in src_mesh.polygons]
src_co = [v.co.copy() for v in src_mesh.vertices]
src_vi = [tuple(p.vertices) for p in src_mesh.polygons]

# ---------------------------------------------------------------- decimate toward the budget
tris = tri_count(obj)
ratio = min(1.0, BUDGET * 0.92 / max(tris, 1))
for _ in range(4):
    if tri_count(obj) <= BUDGET:
        break
    mod = obj.modifiers.new("dec", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    ratio = min(0.95, BUDGET * 0.9 / max(tri_count(obj), 1))
decimated_tris = tri_count(obj)

# ---------------------------------------------------------------- transfer colour from the source onto the decimated faces
mesh = obj.data
# Each final face takes the colour of the source surface under it: the centroid plus three points halfway to the
# corners, each looked up in the source mesh by nearest point and barycentric blend of its corner colours.
from mathutils.interpolate import poly_3d_calc


def source_colour(pt):
    loc, _n, fi, _d = src_bvh.find_nearest(pt)
    if fi is None:
        return [0.5, 0.5, 0.5]
    vs = [src_co[i] for i in src_vi[fi]]
    wts = poly_3d_calc(vs, loc)
    loops = src_tris[fi]
    return [sum(wts[k] * src_col[loops[k]][c] for k in range(3)) for c in range(3)]


face_avg = []
for poly in mesh.polygons:
    vs = [mesh.vertices[i].co for i in poly.vertices]
    ctr = poly.center
    acc = [0.0, 0.0, 0.0]
    pts = [ctr] + [ctr.lerp(v, 0.5) for v in vs]
    for pt in pts:
        c = source_colour(pt)
        for k in range(3):
            acc[k] += c[k] / len(pts)
    face_avg.append(acc)

# The source copy has done its job; leaving it in the scene would export it too.
bpy.data.objects.remove(src_obj)
bpy.data.meshes.remove(src_mesh)

# ---------------------------------------------------------------- orient, fit, ground
# Blender is Z-up: game x = x, game up = z, game z = -y. Rotate about the up axis first.
if ROT_Y_ARG == "auto":
    _xs = [v.co.x for v in obj.data.vertices]
    _ys = [v.co.y for v in obj.data.vertices]
    ROT_Y = 90.0 if (max(_ys) - min(_ys)) > (max(_xs) - min(_xs)) else 0.0
else:
    ROT_Y = float(ROT_Y_ARG)
if ROT_Y:
    # Straight on the mesh: transform_apply only touches the selection, which may not hold obj by now.
    obj.data.transform(Matrix.Rotation(math.radians(ROT_Y), 4, "Z"))
mesh = obj.data
bmin = Vector((min(v.co[i] for v in mesh.vertices) for i in range(3)))
bmax = Vector((max(v.co[i] for v in mesh.vertices) for i in range(3)))
size = bmax - bmin  # blender x, y, z == game width, depth, height
scale = min(FIT[0] / size.x, FIT[2] / size.y, FIT[1] / size.z)
centre = Vector(((bmin.x + bmax.x) / 2, (bmin.y + bmax.y) / 2, bmin.z))
for v in mesh.vertices:
    v.co = (v.co - centre) * scale
mesh.update()

# ---------------------------------------------------------------- snap faces to the palette, flat shade, split glass
mat_body = bpy.data.materials.new("body")
mat_glass = bpy.data.materials.new("glass")
mesh.materials.clear()
mesh.materials.append(mat_body)
mesh.materials.append(mat_glass)
n_loops = len(mesh.loops)
final_buf = [1.0] * (n_loops * 4)
# The texture carries the reference image's shading (shadowed sides, dark undersides), which would snap to the greys.
# A single gain, chosen so the p90 face is as bright as cream, undoes most of it without touching hue.
lum = sorted(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] for c in face_avg)
p90 = lum[int(len(lum) * 0.9)] if lum else 1.0
cream_y = 0.2126 * entries[0]["lin"][0] + 0.7152 * entries[0]["lin"][1] + 0.0722 * entries[0]["lin"][2]
gain = 1.0 if EXPOSE == "0" else max(0.8, min(2.5, cream_y / max(p90, 1e-4)))
labels = [entries.index(nearest([min(1.0, c * gain) for c in avg])) for avg in face_avg]
# Per-face snapping of a noisy texture gives salt-and-pepper camouflage. A couple of majority votes over the
# edge-adjacent faces turn it into the flat colour regions a toy has. Clusters of glass faces (windows) survive.
if SMOOTH:
    _bm = bmesh.new()
    _bm.from_mesh(mesh)
    _bm.faces.ensure_lookup_table()
    nbrs = [[f2.index for e in f.edges for f2 in e.link_faces if f2 is not f] for f in _bm.faces]
    _bm.free()
    glass_ids = {i for i, e in enumerate(entries) if e.get("glass")}
    for _ in range(SMOOTH):
        nxt = list(labels)
        for i, nb in enumerate(nbrs):
            if labels[i] in glass_ids and any(labels[j] == labels[i] for j in nb):
                continue
            votes = {labels[i]: 1.2}
            for j in nb:
                votes[labels[j]] = votes.get(labels[j], 0.0) + 1.0
            nxt[i] = max(votes, key=votes.get)
        labels = nxt
for poly, li_idx in zip(mesh.polygons, labels):
    e = entries[li_idx]
    e["count"] += 1
    for li in poly.loop_indices:
        final_buf[li * 4 : li * 4 + 3] = e["lin"]
    poly.material_index = 1 if e.get("glass") else 0
    poly.use_smooth = False
final = mesh.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
final.data.foreach_set("color", final_buf)
mesh.color_attributes.active_color = final
mesh.color_attributes.render_color_index = mesh.color_attributes.find("Col")
for uvl in list(mesh.uv_layers):
    mesh.uv_layers.remove(uvl)
obj.name = f"{KIND}"

# ---------------------------------------------------------------- export
for m in (mat_body, mat_glass):
    m.use_nodes = True
    n = m.node_tree.nodes
    attr = n.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    m.node_tree.links.new(attr.outputs["Color"], n["Principled BSDF"].inputs["Base Color"])
    n["Principled BSDF"].inputs["Roughness"].default_value = 0.78
Path(DST).parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=DST,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_image_format="NONE",
    export_texcoords=False,
    export_normals=True,
    export_vertex_color="ACTIVE",
    export_cameras=False,
    export_lights=False,
    use_selection=False,
)

# ---------------------------------------------------------------- stats
out = {
    "raw_tris": raw_tris,
    "raw_verts": raw_verts,
    "decimated_tris": decimated_tris,
    "final_tris": tri_count(obj),
    "final_size_game_xyz": [round(size.x * scale, 3), round(size.z * scale, 3), round(size.y * scale, 3)],
    "scale_applied": round(scale, 5),
    "had_texture": image is not None,
    "exposure_gain": round(gain, 3),
    "rot_y": ROT_Y,
    "palette_faces": {e["name"]: e["count"] for e in entries if e["count"]},
}
if STATS:
    Path(STATS).write_text(json.dumps(out, indent=2))
print("CLEAN_STATS " + json.dumps(out))
