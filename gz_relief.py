# Genera los mapas de relieve y las texturas del personaje a partir del dibujo original.
# Uso: python -I gz_relief.py <carpeta del proyecto>
import cv2, numpy as np, math, sys, os

D = sys.argv[1]
# versión HD redibujada, alineada al PNG original (colores); el alfa sale del original
_hd = os.path.join(D, "gamerzone-logo_hd.png")
im4 = cv2.imread(_hd if os.path.exists(_hd) else os.path.join(D, "gamerzone-logo_4x.png"), cv2.IMREAD_UNCHANGED)
S4 = im4.shape[1] / 447.0
CELL = 2.0  # px del original por celda de la malla (0.02 m)

# siluetas calcadas sobre el dibujo (px del PNG original de 447)
HOOD = [(222, 26), (210, 30), (200, 37), (191, 50), (182, 60), (176, 72), (172, 90), (171, 110), (173, 127),
        (186, 142), (200, 153), (222, 163), (246, 153), (262, 142), (274, 128), (277, 110), (276, 90),
        (272, 72), (266, 60), (258, 50), (244, 37), (234, 30)]
FACE = [(222, 71), (210, 74), (200, 81), (193, 101), (192, 121), (200, 139), (212, 151), (222, 159),
        (234, 151), (246, 139), (256, 119), (254, 99), (244, 81), (234, 74)]
BODY = [(152, 128), (127, 133), (109, 148), (102, 170), (101, 200), (102, 230), (104, 268), (345, 268),
        (345, 230), (344, 190), (342, 160), (335, 147), (315, 133), (290, 128), (268, 130), (262, 112),
        (222, 104), (185, 112)]
# antebrazo delantero con el puño y la muñequera: pieza aparte para poder moverlo más
FOREARM = [(174, 222), (178, 214), (192, 213), (207, 215), (230, 219), (255, 222), (280, 225), (296, 229),
           (304, 236), (306, 246), (300, 254), (270, 252), (240, 249), (215, 247), (198, 246), (184, 243),
           (176, 236)]
EYES = [((207, 103), (6.5, 3.2), 18), ((242, 103), (6.5, 3.2), -18)]  # centro, semiejes, inclinación
BANNER = [(102, 274), (345, 257), (343, 333), (122, 353)]

H, W = int(447 / CELL), int(447 / CELL)


def poly_mask(pts, scale):
    m = np.zeros((int(447 * scale), int(447 * scale)), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(pts) * scale).astype(np.int32)], 255)
    return m


def gauss(cx, cy, sx, sy=None):
    sy = sy or sx
    yy, xx = np.mgrid[0:H, 0:W]
    u, v = (xx + 0.5) * CELL, (yy + 0.5) * CELL
    return np.exp(-(((u - cx) / sx) ** 2 + ((v - cy) / sy) ** 2) / 2)


def band(p0, p1, width):
    """Gaussiana a lo largo de un segmento (para brazos)."""
    yy, xx = np.mgrid[0:H, 0:W]
    P = np.stack([(xx + 0.5) * CELL, (yy + 0.5) * CELL], -1)
    a, b = np.array(p0, float), np.array(p1, float)
    t = np.clip(((P - a) @ (b - a)) / np.dot(b - a, b - a), 0, 1)
    d = np.linalg.norm(P - (a + t[..., None] * (b - a)), axis=-1)
    return np.exp(-(d / width) ** 2 / 2)


def inflate(mask, height, radius):
    """Perfil redondeado: sube rápido en el borde y se aplana adentro."""
    dt = cv2.distanceTransform((mask > 0).astype(np.uint8), cv2.DIST_L2, 5) * CELL
    k = np.clip(dt / radius, 0, 1)
    return height * np.sqrt(1 - (1 - k) ** 2), dt


s = 1 / CELL
hood_m = poly_mask(HOOD, s)
face_m = cv2.GaussianBlur(poly_mask(FACE, s).astype(np.float32) / 255, (0, 0), 1.2)
body_m = poly_mask(BODY, s)
arm_m = poly_mask(FOREARM, s)

# capucha: domo, cara hundida y máscara abombada adentro
h_hood, _ = inflate(hood_m, 0.30, 30)
h_hood = h_hood - face_m * 0.12 + face_m * 0.10 * gauss(224, 112, 22, 34) / 1.0
h_hood += 0.06 * gauss(222, 40, 14)  # punta

# cuerpo: base + hombros + pecho + antebrazos cruzados
h_body, _ = inflate(body_m, 0.22, 26)
h_body += 0.20 * gauss(132, 175, 30, 45) + 0.20 * gauss(318, 175, 30, 45)   # hombros / brazos
h_body += 0.10 * gauss(224, 185, 45, 30)                                     # pecho
h_body += 0.14 * band((120, 250), (300, 262), 14)                            # antebrazo de abajo
h_body *= (body_m > 0)

# antebrazo: tubo redondeado que se apoya sobre el cuerpo
h_arm, _ = inflate(arm_m, 0.16, 12)
h_arm += 0.05 * band((300, 242), (185, 228), 10)
h_arm *= (arm_m > 0)

np.savez(os.path.join(D, "relief.npz"), cell=CELL, hood=(hood_m > 0), h_hood=h_hood.astype(np.float32),
         body=(body_m > 0), h_body=h_body.astype(np.float32),
         arm=(arm_m > 0), h_arm=h_arm.astype(np.float32),
         eyes=np.array([[c[0], c[1], r[0], r[1], a] for c, r, a in EYES], np.float32))

# ---------- texturas ----------
bgr, alpha = im4[..., :3].copy(), im4[..., 3]
# quitar el texto blanco (lo tapa la franja, pero al volar se vería)
zone = cv2.dilate(poly_mask(BANNER, S4), np.ones((int(30 * S4),) * 2, np.uint8)) > 0
white = (zone & (bgr.min(-1) > 150) & (alpha > 128)).astype(np.uint8) * 255
bgr = cv2.inpaint(bgr, cv2.dilate(white, np.ones((7, 7), np.uint8)), 9, cv2.INPAINT_TELEA)
# ojos en negro: los ojos 3D brillantes van encima (y pueden parpadear)
for (cx, cy), (rx, ry), ang in EYES:
    cv2.ellipse(bgr, (int(cx * S4), int(cy * S4)), (int((rx + 2.5) * S4), int((ry + 2.5) * S4)), ang, 0, 360,
                (8, 6, 6), -1)
tex_hood = np.dstack([bgr, np.full_like(alpha, 255)])
tex_arm = tex_hood.copy()
# cuerpo: lo que tapa la capucha va en el color de la chaqueta
body_bgr = bgr.copy()
hm = cv2.erode(poly_mask(HOOD, S4), np.ones((int(6 * S4),) * 2, np.uint8)) > 0
body_bgr[hm] = (66, 52, 50)
# lo que tapa el antebrazo se rellena con lo que lo rodea (pecho cian arriba, brazo oscuro abajo)
am = cv2.dilate(poly_mask(FOREARM, S4), np.ones((int(3 * S4),) * 2, np.uint8))
# relleno dibujado al estilo del logo: la camiseta cian sigue hacia abajo con su línea central,
# luego un contorno negro y debajo el otro brazo (oscuro)
cyan = bgr[int(200 * S4), int(240 * S4)].astype(int).tolist()
fill = body_bgr.copy()
yy = np.arange(fill.shape[0])[:, None] / S4
xx = np.arange(fill.shape[1])[None, :] / S4
split = 236 + (xx - 220) * 0.06            # borde levemente inclinado, como el brazo
fill[np.broadcast_to(yy < split, fill.shape[:2])] = cyan
fill[np.broadcast_to(yy >= split, fill.shape[:2])] = (66, 52, 50)
line = np.broadcast_to(np.abs(yy - split) < 1.6, fill.shape[:2])
fill[line] = (8, 6, 6)
center = np.broadcast_to((np.abs(xx - 222) < 3.2) & (yy < split), fill.shape[:2])
fill[center] = (8, 6, 6)
fill = cv2.GaussianBlur(fill, (0, 0), 1.2)
amb = cv2.GaussianBlur(am.astype(np.float32) / 255, (0, 0), 2)[..., None]
body_bgr = (fill * amb + body_bgr * (1 - amb)).astype(np.uint8)
tex_body = np.dstack([body_bgr, np.full_like(alpha, 255)])
cv2.imwrite(os.path.join(D, "tex_hood.png"), tex_hood)
cv2.imwrite(os.path.join(D, "tex_body.png"), tex_body)
cv2.imwrite(os.path.join(D, "tex_arm.png"), tex_arm)
cv2.imwrite(os.path.join(D, "_body_preview.png"), cv2.resize(body_bgr[int(190 * S4):int(270 * S4), int(160 * S4):int(320 * S4)], None, fx=0.6, fy=0.6))

# vista previa del relieve
pv = np.zeros((H, W * 2), np.float32)
pv[:, :W] = h_hood / max(h_hood.max(), 1e-6)
pv[:, W:] = h_body / max(h_body.max(), 1e-6)
cv2.imwrite(os.path.join(D, "_relief_preview.png"), (pv * 255).astype(np.uint8))
print("hood max", h_hood.max(), "body max", h_body.max())
