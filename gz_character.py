# Modela desde cero al encapuchado de GamerZone (coordenadas de mundo en el cuadro final, frente hacia -Y).
exec(open(r"C:\Users\Usuario\Desktop\blender\gamerzone-logo\gz_helpers.py").read())
from mathutils import Matrix, Euler

sc = bpy.context.scene
sc.frame_set(sc.frame_end)
emp = bpy.data.objects["GZ_Character"]
col = bpy.data.collections["GamerZone_Logo"]

# limpiar versión anterior
for o in list(emp.children_recursive):
    bpy.data.objects.remove(o)

M = dict(
    jacket=mat("GZ_Char_Jacket", (0.035, 0.04, 0.065), 0.0, 0.6),
    jacket_hi=mat("GZ_Char_JacketHi", (0.03, 0.035, 0.06), 0.0, 0.5),
    cyan=mat("GZ_Char_Cyan", (0.20, 0.92, 0.95), 0.0, 0.4, 0.8),
    mask=mat("GZ_Char_Mask", (0.008, 0.009, 0.012), 0.3, 0.25),
    eyes=mat("GZ_Char_Eyes", (1.0, 1.0, 1.0), 0.0, 0.3, 8.0, (0.75, 1.0, 1.0)),
    tan=mat("GZ_Char_Fur", (0.93, 0.70, 0.52), 0.0, 0.7),
    band=mat("GZ_Char_Band", (0.32, 0.34, 0.38), 0.6, 0.35),
    dark=mat("GZ_Char_Dark", (0.02, 0.02, 0.03), 0.0, 0.5),
)


def link(ob, *mats):
    col.objects.link(ob)
    for m in mats:
        ob.data.materials.append(m)
    ob.parent = emp
    ob.matrix_parent_inverse = emp.matrix_world.inverted()
    return ob


def smooth(ob, levels=2):
    for p in ob.data.polygons:
        p.use_smooth = True
    s = ob.modifiers.new("Subsurf", "SUBSURF")
    s.levels = levels
    s.render_levels = levels


# ---------- torso + brazos (skin modifier) ----------
Y = -0.80
nodes = {
    "pelvis": ((0, Y, -0.75), (0.62, 0.30)),
    "belly": ((0, Y, -0.15), (0.66, 0.33)),
    "chest": ((0, Y + 0.02, 0.42), (0.86, 0.40)),
    "neck": ((0, Y + 0.05, 0.92), (0.30, 0.24)),
    "sh_L": ((-0.90, Y + 0.05, 0.62), (0.46, 0.42)),
    "sh_R": ((0.90, Y + 0.05, 0.62), (0.46, 0.42)),
    "el_L": ((-1.04, -1.00, -0.05), (0.32, 0.31)),
    "el_R": ((1.04, -1.00, 0.02), (0.32, 0.31)),
    # antebrazo trasero (va de izquierda a derecha, más abajo)
    "wr_L": ((0.50, -1.18, -0.20), (0.20, 0.20)),
    # antebrazo delantero (va de derecha a izquierda, por encima)
    "wr_R": ((-0.38, -1.36, 0.06), (0.21, 0.21)),
}
edges = [("pelvis", "belly"), ("belly", "chest"), ("chest", "neck"), ("chest", "sh_L"), ("chest", "sh_R"),
         ("sh_L", "el_L"), ("sh_R", "el_R"), ("el_L", "wr_L"), ("el_R", "wr_R")]
names = list(nodes)
me = bpy.data.meshes.new("GZ_Char_Body")
me.from_pydata([nodes[n][0] for n in names], [(names.index(a), names.index(b)) for a, b in edges], [])
body = bpy.data.objects.new("GZ_Char_Body", me)
link(body, M["jacket"])
sk = body.modifiers.new("Skin", "SKIN")
sk.branch_smoothing = 0.6
for i, n in enumerate(names):
    me.skin_vertices[0].data[i].radius = nodes[n][1]
me.skin_vertices[0].data[0].use_root = True
smooth(body, 2)


def ball(name, loc, scale, m, rot=(0, 0, 0), segs=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    ob.scale = scale
    ob.rotation_euler = [math.radians(a) for a in rot]
    for p in me.polygons:
        p.use_smooth = True
    return link(ob, m)


# puños
ball("GZ_Char_FistR", (-0.58, -1.30, 0.07), (0.18, 0.16, 0.17), M["jacket"])
ball("GZ_Char_FistL", (0.74, -1.10, -0.16), (0.17, 0.15, 0.16), M["jacket"])

# muñequera en el antebrazo delantero
a = Vector(nodes["el_R"][0]); b = Vector(nodes["wr_R"][0])
d = (b - a).normalized()
for k, t in enumerate((0.70, 0.76, 0.82)):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.235, radius2=0.235, depth=0.055)
    me_ = bpy.data.meshes.new("GZ_Char_Band%d" % k)
    bm.to_mesh(me_)
    bm.free()
    ob = bpy.data.objects.new("GZ_Char_Band%d" % k, me_)
    ob.location = a.lerp(b, t)
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    for p in me_.polygons:
        p.use_smooth = True
    link(ob, M["band"])

# ---------- cabeza / máscara ----------
head = ball("GZ_Char_Head", (0, -0.86, 1.28), (0.31, 0.30, 0.37), M["mask"], segs=32)
# barbilla en punta, estilo máscara
for v in head.data.vertices:
    if v.co.z < -0.3:
        v.co.z -= (abs(v.co.z) - 0.3) * 0.9
        v.co.x *= 0.85
smooth(head, 1)


# ojos: rendijas inclinadas y brillantes
for sx in (-1, 1):
    # el extremo interior baja hacia el centro: mirada enojada
    e = ball("GZ_Char_Eye" + ("L" if sx < 0 else "R"), (0.115 * sx, -1.145, 1.33), (0.09, 0.03, 0.03),
             M["eyes"], rot=(0, -24 * sx, 0), segs=16)
    for v in e.data.vertices:
        if v.co.x * sx < 0:  # punta interior más afilada
            v.co.z *= 0.45

# ---------- capucha ----------
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=1.0)
for v in bm.verts:
    v.co.x *= 0.50
    v.co.y *= 0.48
    v.co.z *= 0.58
    # punta de la capucha
    if v.co.z > 0.25:
        k = (v.co.z - 0.25) / 0.33
        v.co.z += k * k * 0.26
        v.co.x *= 1 - 0.55 * k
        v.co.y *= 1 - 0.35 * k
        v.co.y += k * 0.06
    # cae ancho sobre los hombros
    if v.co.z < -0.1:
        k = min(1, (-0.1 - v.co.z) / 0.45)
        v.co.x *= 1 + 0.55 * k
        v.co.y *= 1 + 0.25 * k
# abrir la cara
def opening_w(z):
    # abertura en forma de almendra: redonda abajo, en punta arriba
    t = (z + 0.40) / 0.78
    if not 0 <= t <= 1:
        return -1
    return 0.30 * math.sqrt(max(0, 1 - t ** 2.4)) * min(1, 0.55 + t * 2)
kill = [f for f in bm.faces if f.calc_center_median().y < -0.15
        and abs(f.calc_center_median().x) < opening_w(f.calc_center_median().z)]
bmesh.ops.delete(bm, geom=kill, context='FACES')
# abrir la base
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z < -0.5], context='FACES')
# suavizar el borde escalonado de la abertura
front_b = [v for v in bm.verts if v.is_boundary and v.co.y < -0.05]
for _ in range(8):
    newp = {}
    for v in front_b:
        nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
        if len(nb) == 2:
            newp[v] = v.co * 0.5 + (nb[0].co + nb[1].co) * 0.25
    for v, p in newp.items():
        v.co = p
# ribete cian alrededor de la cara (bordes libres del frente)
trim_edges = [e for e in bm.edges if e.is_boundary and all(v.co.y < -0.05 for v in e.verts)]
tv = sorted({v for e in trim_edges for v in e.verts}, key=lambda v: v.index)
ti = {v: i for i, v in enumerate(tv)}
trim_me = bpy.data.meshes.new("GZ_Char_HoodTrim")
trim_me.from_pydata([v.co.copy() for v in tv], [(ti[e.verts[0]], ti[e.verts[1]]) for e in trim_edges], [])
me = bpy.data.meshes.new("GZ_Char_Hood")
bm.to_mesh(me)
bm.free()
trim = bpy.data.objects.new("GZ_Char_HoodTrim", trim_me)
trim.location = (0, -0.80, 1.22)
link(trim, M["cyan"])
ts = trim.modifiers.new("Skin", "SKIN")
for sv in trim_me.skin_vertices[0].data:
    sv.radius = (0.045, 0.045)
smooth(trim, 1)
hood = bpy.data.objects.new("GZ_Char_Hood", me)
hood.location = (0, -0.80, 1.22)
link(hood, M["jacket_hi"], M["cyan"])
for p in me.polygons:
    p.use_smooth = True
so = hood.modifiers.new("Thick", "SOLIDIFY")
so.thickness = 0.05
so.offset = -1
so.material_offset = 1
so.material_offset_rim = 1
smooth(hood, 2)

# ---------- pecho cian (camiseta) y cierre ----------
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=40, y_segments=40, size=1.0)
# forma de V: ancho arriba, angosto abajo
bmesh.ops.delete(bm, geom=[f for f in bm.faces
                           if abs(f.calc_center_median().x) > 0.5 + 0.5 * (f.calc_center_median().y + 1) / 2],
                 context='FACES')
bnd = [v for v in bm.verts if v.is_boundary]
for _ in range(6):
    newp = {}
    for v in bnd:
        nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
        if len(nb) == 2:
            newp[v] = v.co * 0.5 + (nb[0].co + nb[1].co) * 0.25
    for v, p in newp.items():
        v.co = p
me = bpy.data.meshes.new("GZ_Char_Shirt")
bm.to_mesh(me)
bm.free()
shirt = bpy.data.objects.new("GZ_Char_Shirt", me)
shirt.location = (0, -1.25, 0.48)
shirt.rotation_euler = (math.radians(90), 0, 0)
shirt.scale = (0.62, 0.46, 1)
link(shirt, M["cyan"])
sw = shirt.modifiers.new("Wrap", "SHRINKWRAP")
sw.target = body
sw.wrap_method = 'PROJECT'
sw.use_project_z = True
sw.use_negative_direction = True
sw.use_positive_direction = True
sw.offset = 0.012
sl = shirt.modifiers.new("Thick", "SOLIDIFY")
sl.thickness = 0.015
for p in me.polygons:
    p.use_smooth = True

# cordones de la capucha en "Y"
def cord(name, pts, r=0.028, m=None):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 3
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    ob = bpy.data.objects.new(name, cu)
    return link(ob, m or M["dark"])

cord("GZ_Char_CordL", [(-0.16, -1.12, 0.98), (-0.05, -1.24, 0.68), (0.0, -1.27, 0.48)])
cord("GZ_Char_CordR", [(0.16, -1.12, 0.98), (0.05, -1.24, 0.68), (0.0, -1.27, 0.48)])
cord("GZ_Char_Zip", [(0.0, -1.27, 0.48), (0.0, -1.29, 0.30), (0.0, -1.33, 0.14)], r=0.032)

# ---------- emblema en el pecho (en lugar del logo de Xbox) ----------
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=True, segments=32, radius=0.11)
me = bpy.data.meshes.new("GZ_Char_Emblem")
bm.to_mesh(me)
bm.free()
emb = bpy.data.objects.new("GZ_Char_Emblem", me)
emb.location = (0.27, -1.27, 0.62)
emb.rotation_euler = (math.radians(90), 0, 0)
link(emb, M["dark"])
emb.modifiers.new("Thick", "SOLIDIFY").thickness = 0.02
ring = bpy.data.objects.new("GZ_Char_EmblemRing", bpy.data.meshes.new("GZ_Char_EmblemRing"))
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=False, segments=32, radius=0.11)
bm.to_mesh(ring.data)
bm.free()
ring.location = (0.27, -1.285, 0.62)
ring.rotation_euler = (math.radians(90), 0, 0)
link(ring, M["cyan"])
sk2 = ring.modifiers.new("Skin", "SKIN")
for sv in ring.data.skin_vertices[0].data:
    sv.radius = (0.014, 0.014)

# ---------- pelaje claro en hombros ----------
import random
random.seed(7)
for sx in (-1, 1):
    for k in range(6):
        t = k / 5
        base = Vector((sx * (1.13 + 0.05 * math.sin(t * 3)), -0.88, 0.72 - t * 0.8))
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.11, radius2=0.0, depth=0.32)
        me_ = bpy.data.meshes.new("GZ_Char_Fur")
        bm.to_mesh(me_)
        bm.free()
        ob = bpy.data.objects.new("GZ_Char_Fur", me_)
        ob.location = base
        ob.rotation_euler = (math.radians(random.uniform(-15, 15)), math.radians(sx * (55 + random.uniform(-15, 25))), 0)
        ob.scale = (1, 0.55, 1)
        for p in me_.polygons:
            p.use_smooth = True
        link(ob, M["tan"])

# ---------- contorno cartoon ----------
for o in emp.children:
    if o.type == 'MESH' and not o.name.startswith(("GZ_Char_Eye", "GZ_Char_Shirt", "GZ_Char_EmblemRing", "GZ_Char_HoodTrim")):
        add_outline(o, 0.022)
print("personaje:", len(emp.children), "piezas")
# la capucha usa 2 materiales antes del contorno: un slot extra evita índices fuera de rango
hood.data.materials.append(outline_mat())

# ---------- pivotes para animar en la web ----------
def pivot(name, loc, parent):
    p = bpy.data.objects.new(name, None)
    col.objects.link(p)
    p.empty_display_size = 0.2
    p.parent = parent
    p.matrix_world = Matrix.Translation(loc)
    return p

parts = [o for o in emp.children]
rig = pivot("GZ_Char_Rig", Vector((0, -0.80, -0.75)), emp)        # respiración (desde la cadera)
head_pivot = pivot("GZ_Char_HeadPivot", Vector((0, -0.82, 0.95)), rig)  # giro de cabeza (desde el cuello)
bpy.context.view_layer.update()
head_names = ("GZ_Char_Hood", "GZ_Char_HoodTrim", "GZ_Char_Head", "GZ_Char_EyeL", "GZ_Char_EyeR")
for o in parts:
    mw = o.matrix_world.copy()
    o.parent = head_pivot if o.name in head_names else rig
    o.matrix_world = mw
print("rig listo")
