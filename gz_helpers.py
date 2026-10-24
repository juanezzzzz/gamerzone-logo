# Utilidades compartidas para construir el logo GamerZone en Blender.
# Coordenadas de imagen (u, v) en píxeles del PNG de 447 px -> mundo: x=(u-C)*S, z=(C-v)*S, frente hacia -Y.
import bpy, bmesh, math
import numpy as np
from mathutils import Vector

S = 0.01
C = 223.5

SHIELD_PTS = [(225, 43), (370, 106), (352, 262), (225, 390), (102, 272), (81, 106)]
TRIANGLE_PTS = [(4, 145), (394, 46), (272, 405)]


def to3(u, v):
    return ((u - C) * S, (C - v) * S)


def round_poly(pts, rad, seg=6):
    out = []
    P = [np.array(p, float) for p in pts]
    n = len(P)
    for i in range(n):
        p0, p1, p2 = P[i - 1], P[i], P[(i + 1) % n]
        d1 = (p0 - p1) / np.linalg.norm(p0 - p1)
        d2 = (p2 - p1) / np.linalg.norm(p2 - p1)
        a = math.acos(np.clip(np.dot(d1, d2), -1, 1))
        t = min(rad / math.tan(a / 2), 0.45 * np.linalg.norm(p0 - p1), 0.45 * np.linalg.norm(p2 - p1))
        A = p1 + d1 * t
        B = p1 + d2 * t
        for k in range(seg + 1):
            s = k / seg
            out.append(tuple((1 - s) ** 2 * A + 2 * (1 - s) * s * p1 + s * s * B))
    return out


def inset_poly(pts, d):
    """Desplaza hacia adentro un polígono convexo d píxeles (intersección de aristas desplazadas)."""
    P = [np.array(p, float) for p in pts]
    n = len(P)
    area = sum(P[i][0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * P[i][1] for i in range(n))
    sgn = 1 if area > 0 else -1
    lines = []
    for i in range(n):
        a, b = P[i], P[(i + 1) % n]
        t = (b - a) / np.linalg.norm(b - a)
        nrm = np.array([-t[1], t[0]]) * sgn  # normal hacia adentro
        lines.append((a + nrm * d, t))
    out = []
    for i in range(n):
        (p1, t1), (p2, t2) = lines[i - 1], lines[i]
        A = np.array([t1, -t2]).T
        s = np.linalg.solve(A, p2 - p1)[0]
        out.append(tuple(p1 + t1 * s))
    return out


def slab(bm, pts_uv, y_front, depth, mat_front=0, mat_side=1):
    """Agrega a bm un prisma extruido desde un polígono en coordenadas de imagen."""
    vs = []
    for u, v in pts_uv:
        x, z = to3(u, v)
        vs.append(bm.verts.new((x, y_front, z)))
    f = bm.faces.new(vs)
    f.normal_update()
    if f.normal.y > 0:
        f.normal_flip()
    r = bmesh.ops.extrude_face_region(bm, geom=[f], use_keep_orig=True)
    nv = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    nf = [e for e in r['geom'] if isinstance(e, bmesh.types.BMFace)]
    bmesh.ops.translate(bm, verts=nv, vec=(0, depth, 0))
    faces = [f] + nf + [ff for v in nv for ff in v.link_faces]
    faces = list(set(faces))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    for ff in faces:
        ff.material_index = mat_front if ff.normal.y < -0.9 else mat_side
    return faces


def mat(name, col, metal=0.0, rough=0.5, emit=0.0, emit_col=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bs.inputs['Base Color'].default_value = (*col, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    ec = emit_col or col
    bs.inputs['Emission Color'].default_value = (*ec, 1)
    bs.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = (*col, 1)
    return m


def outline_mat():
    m = mat("GZ_Outline", (0.0, 0.0, 0.0), 0.0, 1.0)
    m.use_backface_culling = True
    return m


def add_outline(ob, thickness=0.02):
    """Contorno negro estilo cartoon (casco invertido)."""
    om = outline_mat()
    if om.name not in ob.data.materials:
        ob.data.materials.append(om)
    idx = list(ob.data.materials).index(om)
    m = ob.modifiers.get("Outline") or ob.modifiers.new("Outline", "SOLIDIFY")
    m.thickness = thickness
    m.offset = 1.0
    m.use_flip_normals = True
    m.use_rim = False
    m.material_offset = idx
    m.material_offset_rim = idx
    return m


def rest_location(ob):
    sc = bpy.context.scene
    f = sc.frame_current
    sc.frame_set(sc.frame_end)
    loc = ob.location.copy()
    sc.frame_set(f)
    return loc
