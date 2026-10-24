# Renderiza la vista frontal ortográfica (GZ_RefCam), alineada 1:1 con el PNG original, para comparar.
import bpy, os
sc = bpy.context.scene
OUT = os.environ.get("GZ_CMP_OUT", r"C:\Users\Usuario\AppData\Local\Temp\gz_cmp.png")
prev = (sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage,
        sc.render.filepath, sc.render.film_transparent)
hidden = []
for name in GZ_HIDE if 'GZ_HIDE' in globals() else ():
    o = bpy.data.objects[name]
    if not o.hide_render:
        o.hide_render = True
        hidden.append(o)
try:
    sc.camera = bpy.data.objects["GZ_RefCam"]
    sc.render.resolution_x = sc.render.resolution_y = 894
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.filepath = OUT
    try:
        sc.eevee.taa_render_samples = 8
    except Exception:
        pass
    bpy.ops.render.render(write_still=True)
finally:
    sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage, \
        sc.render.filepath, sc.render.film_transparent = prev
    for o in hidden:
        o.hide_render = False
print("render:", OUT)
