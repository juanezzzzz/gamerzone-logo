# Esqueleto del personaje en relieve: huesos + pesos calculados sobre la silueta del dibujo.
# Correr después de gz_build_character.py.
exec(open(r"C:\Users\Usuario\Desktop\blender\gamerzone-logo\gz_helpers.py").read())
from mathutils import Matrix

sc = bpy.context.scene
sc.frame_set(sc.frame_end)
emp = bpy.data.objects["GZ_Character"]
col = bpy.data.collections["GamerZone_Logo"]
body = bpy.data.objects["GZ_Char_Body"]
hood = bpy.data.objects["GZ_Char_Hood"]
arm_mesh = bpy.data.objects["GZ_Char_Arm"]
eyes = [bpy.data.objects["GZ_Char_EyeL"], bpy.data.objects["GZ_Char_EyeR"]]

DEPTH = -0.70  # profundidad de los huesos (dentro del relieve)

# nombre: (cabeza uv, cola uv, padre, radio px, borde px)
BONES = {
    "B_Hips":       ((224, 268), (224, 215), None,           40, 20),
    "B_Spine":      ((224, 215), (224, 172), "B_Hips",       55, 25),
    "B_Chest":      ((224, 172), (222, 150), "B_Spine",      60, 25),
    "B_Neck":       ((222, 150), (222, 128), "B_Chest",      25, 15),
    "B_Head":       ((222, 128), (222, 40),  "B_Neck",       0, 0),
    "B_Shoulder.L": ((200, 150), (140, 160), "B_Chest",      35, 15),
    "B_UpperArm.L": ((140, 160), (118, 250), "B_Shoulder.L", 30, 12),
    "B_Forearm.L":  ((118, 250), (300, 262), "B_UpperArm.L", 15, 8),
    "B_Shoulder.R": ((248, 150), (310, 160), "B_Chest",      35, 15),
    "B_UpperArm.R": ((310, 160), (335, 240), "B_Shoulder.R", 30, 12),
    "B_Forearm.R":  ((335, 240), (205, 226), "B_UpperArm.R", 16, 6),
    "B_Hand.R":     ((205, 226), (170, 222), "B_Forearm.R",  20, 6),
}
# de adelante hacia atrás: lo que está encima "gana" los vértices
# (el antebrazo delantero es una pieza aparte: GZ_Char_Arm)
PRIORITY = ["B_Forearm.L", "B_UpperArm.L", "B_UpperArm.R", "B_Shoulder.L", "B_Shoulder.R"]
CORE = ["B_Hips", "B_Spine", "B_Chest", "B_Neck"]

# limpiar pivotes / esqueleto anteriores
for n in ("GZ_Char_Rig", "GZ_Char_HeadPivot", "GZ_Char_Armature"):
    o = bpy.data.objects.get(n)
    if o:
        for c in o.children:
            mw = c.matrix_world.copy()
            c.parent = emp
            c.matrix_world = mw
        bpy.data.objects.remove(o)

# ---------- armadura ----------
arm_data = bpy.data.armatures.new("GZ_Char_Armature")
arm = bpy.data.objects.new("GZ_Char_Armature", arm_data)
col.objects.link(arm)
arm.parent = emp
arm.matrix_world = Matrix.Identity(4)
arm.show_in_front = True
bpy.context.view_layer.objects.active = arm
for o in bpy.context.selected_objects:
    o.select_set(False)
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name, (h, t, parent, _, _) in BONES.items():
    b = arm_data.edit_bones.new(name)
    hx, hz = to3(*h)
    tx, tz = to3(*t)
    b.head = (hx, DEPTH, hz)
    b.tail = (tx, DEPTH, tz)
    b.roll = 0
for name, (_, _, parent, _, _) in BONES.items():
    if parent:
        arm_data.edit_bones[name].parent = arm_data.edit_bones[parent]
        arm_data.edit_bones[name].use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')


def seg_dist(P, a, b):
    a, b = np.array(a, float), np.array(b, float)
    t = np.clip(((P - a) @ (b - a)) / np.dot(b - a, b - a), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * (b - a)), axis=1)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def vertex_uv(ob):
    me = ob.data
    co = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    mw = np.array(ob.matrix_world)
    w = co @ mw[:3, :3].T + mw[:3, 3]
    return np.stack([w[:, 0] / S + C, C - w[:, 2] / S], 1)


def body_weights(P):
    raw = {}
    for name, (h, t, _, r, f) in BONES.items():
        if name in ("B_Head", "B_Forearm.R", "B_Hand.R"):
            continue
        raw[name] = smoothstep(r + f, r - f, seg_dist(P, h, t))
    W = {}
    remaining = np.ones(len(P))
    for name in PRIORITY:
        W[name] = raw[name] * remaining
        remaining = remaining - W[name]
    core = np.stack([raw[n] for n in CORE], 1) + 1e-4
    core[:, CORE.index("B_Spine")] += 1e-3  # respaldo
    core /= core.sum(1, keepdims=True)
    for i, n in enumerate(CORE):
        W[n] = core[:, i] * remaining
    return W


def arm_weights(P):
    # el puño (izquierda) sigue a la mano; el resto al antebrazo
    wh = smoothstep(206, 194, P[:, 0])
    return {"B_Hand.R": wh, "B_Forearm.R": 1 - wh}


def hood_weights(P):
    wh = smoothstep(152, 132, P[:, 1])  # la parte baja de la capucha se funde con el cuello
    return {"B_Head": wh, "B_Neck": 1 - wh}


def bind(ob, W):
    ob.vertex_groups.clear()
    for name, w in W.items():
        vg = ob.vertex_groups.new(name=name)
        for i in np.nonzero(w > 1e-3)[0]:
            vg.add([int(i)], float(w[i]), 'REPLACE')
    mw = ob.matrix_world.copy()
    ob.parent = arm
    ob.matrix_world = mw
    m = ob.modifiers.get("Armature") or ob.modifiers.new("Armature", "ARMATURE")
    m.object = arm
    # el armature debe deformar antes del contorno
    ob.modifiers.move(ob.modifiers.find("Armature"), 0)


bind(body, body_weights(vertex_uv(body)))
bind(hood, hood_weights(vertex_uv(hood)))
bind(arm_mesh, arm_weights(vertex_uv(arm_mesh)))

# los ojos siguen al hueso de la cabeza
for e in eyes:
    mw = e.matrix_world.copy()
    e.parent = arm
    e.parent_type = 'BONE'
    e.parent_bone = "B_Head"
    e.matrix_world = mw

bpy.context.view_layer.update()
print("esqueleto listo:", len(BONES), "huesos")
