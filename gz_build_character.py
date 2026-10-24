# Construye el personaje en relieve 3D a partir de relief.npz (ver gz_relief.py) con el dibujo proyectado.
exec(open(r"C:\Users\Usuario\Desktop\blender\gamerzone-logo\gz_helpers.py").read())
from mathutils import Matrix

D = r"C:\Users\Usuario\Desktop\blender\gamerzone-logo"
R = np.load(D + r"\relief.npz")
CELL = float(R["cell"])
sc = bpy.context.scene
sc.frame_set(sc.frame_end)
emp = bpy.data.objects["GZ_Character"]
col = bpy.data.collections["GamerZone_Logo"]
for o in list(emp.children_recursive):
    bpy.data.objects.remove(o)
bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

BODY_BACK = -0.36  # justo delante del escudo


def corner_heights(mask, h):
    """Altura en las esquinas de las celdas; 0 en el borde de la silueta."""
    Hc, Wc = mask.shape
    pad_m = np.pad(mask, 1)
    pad_h = np.pad(h, 1)
    quads_m = [pad_m[i:i + Hc + 1, j:j + Wc + 1] for i in (0, 1) for j in (0, 1)]
    quads_h = [pad_h[i:i + Hc + 1, j:j + Wc + 1] for i in (0, 1) for j in (0, 1)]
    inside_all = np.logical_and.reduce(quads_m)
    hc = sum(quads_h) / 4.0
    return np.where(inside_all, hc, 0.0), np.logical_or.reduce(quads_m), ~inside_all


def body_front_y(u, v):
    i = int(np.clip(v / CELL, 0, R["h_body"].shape[0] - 1))
    j = int(np.clip(u / CELL, 0, R["h_body"].shape[1] - 1))
    return BODY_BACK - (R["h_body"][i, j] if R["body"][i, j] else 0.0)


def build(name, mask, h, back_fn, img_path, smooth_iters=6):
    hc, used, border = corner_heights(mask, h)
    bm = bmesh.new()
    front, back = {}, {}
    Hc, Wc = hc.shape
    for i in range(Hc):
        for j in range(Wc):
            if not used[i, j]:
                continue
            u, v = j * CELL, i * CELL
            x, z = to3(u, v)
            yb = back_fn(u, v)
            front[i, j] = bm.verts.new((x, yb - hc[i, j], z))
            back[i, j] = front[i, j] if border[i, j] else bm.verts.new((x, yb, z))
    for i in range(mask.shape[0]):
        for j in range(mask.shape[1]):
            if mask[i, j]:
                q = [(i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j)]
                bm.faces.new([front[k] for k in q[::-1]])
                try:
                    bm.faces.new([back[k] for k in q])
                except ValueError:
                    pass
    # suavizar el escalonado de la silueta y la superficie
    rim = [v for v in bm.verts if any(e.is_boundary for e in v.link_edges) or
           v in {front[k] for k in front if border[k]}]
    rimset = set(rim)
    rim = list(rimset)
    for _ in range(smooth_iters):
        newp = {}
        for v in rim:
            nb = [e.other_vert(v) for e in v.link_edges if e.other_vert(v) in rimset]
            if len(nb) >= 2:
                avg = sum((n.co for n in nb), Vector()) / len(nb)
                newp[v] = Vector((v.co.x * 0.5 + avg.x * 0.5, v.co.y, v.co.z * 0.5 + avg.z * 0.5))
        for v, p in newp.items():
            v.co = p
    inner = [v for v in bm.verts if v not in rimset]
    for _ in range(3):
        bmesh.ops.smooth_vert(bm, verts=inner, factor=0.5, use_axis_y=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    # UV planar = proyección frontal del dibujo
    uv = me.uv_layers.new(name="LogoUV")
    co = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    li = np.zeros(len(me.loops), int)
    me.loops.foreach_get("vertex_index", li)
    uv.data.foreach_set("uv", np.stack([co[li, 0] / 4.47 + 0.5, co[li, 2] / 4.47 + 0.5], 1).ravel())
    for p in me.polygons:
        p.use_smooth = True
        p.material_index = 0 if p.normal.y < 0.2 else 1
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    fm = bpy.data.materials["GZ_Front_Text"].copy()
    fm.name = "GZ_Front_" + name[3:]
    img = bpy.data.images.load(img_path, check_existing=True)
    img.reload()
    next(n for n in fm.node_tree.nodes if n.type == "TEX_IMAGE").image = img
    me.materials.append(fm)
    me.materials.append(mat("GZ_Char_Back", (0.03, 0.035, 0.05), 0.0, 0.6))
    return ob


body = build("GZ_Char_Body", R["body"], R["h_body"], lambda u, v: BODY_BACK, D + r"\tex_body.png")
hood = build("GZ_Char_Hood", R["hood"], R["h_hood"], lambda u, v: body_front_y(u, v) - 0.01, D + r"\tex_hood.png")
arm = build("GZ_Char_Arm", R["arm"], R["h_arm"], lambda u, v: body_front_y(u, v) - 0.01, D + r"\tex_arm.png")


def hood_front_y(u, v):
    i, j = int(v / CELL), int(u / CELL)
    return body_front_y(u, v) - 0.01 - R["h_hood"][i, j]


# ojos 3D brillantes sobre los ojos del dibujo
eye_mat = mat("GZ_Char_Eyes", (1.0, 1.0, 1.0), 0.0, 0.3, 8.0, (0.75, 1.0, 1.0))
eyes = []
for k, (cu, cv, rx, ry, ang) in enumerate(R["eyes"]):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=1.0)
    sx = -1 if cu < 223.5 else 1
    for v in bm.verts:
        if v.co.x * sx < 0:      # punta interior afilada
            v.co.z *= 0.45
    me = bpy.data.meshes.new("GZ_Char_Eye")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    e = bpy.data.objects.new("GZ_Char_Eye" + ("L" if sx < 0 else "R"), me)
    x, z = to3(cu, cv)
    e.location = (x, hood_front_y(cu, cv) - 0.005, z)
    e.scale = (rx * S * 1.05, 0.02, ry * S * 1.05)
    e.rotation_euler = (0, math.radians(ang), 0)
    me.materials.append(eye_mat)
    col.objects.link(e)
    eyes.append(e)

# contorno cartoon en la silueta
for o in (body, hood, arm):
    add_outline(o, 0.015)
    o.data.materials.append(outline_mat())


# ---------- pivotes para animar en la web ----------
def pivot(name, loc, parent):
    p = bpy.data.objects.new(name, None)
    col.objects.link(p)
    p.empty_display_size = 0.2
    p.parent = parent
    p.matrix_world = Matrix.Translation(loc)
    return p


rig = pivot("GZ_Char_Rig", Vector((0, -0.6, -0.45)), emp)
x, z = to3(222, 150)
head_pivot = pivot("GZ_Char_HeadPivot", Vector((x, -0.75, z)), rig)
bpy.context.view_layer.update()
for o, parent in [(body, rig), (arm, rig), (hood, head_pivot)] + [(e, head_pivot) for e in eyes]:
    mw = o.matrix_world.copy()
    o.parent = parent
    o.matrix_world = mw
print("personaje en relieve:", len(body.data.polygons), "+", len(hood.data.polygons), "caras")
