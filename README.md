# GamerZone E-Sports Center — logo 3D

Logo 3D de GamerZone que se arma con el scroll, hecho en Blender y mostrado en la web con Three.js.

## Web (`web/`)

- `index.html`: página de demostración.
- `gz-logo.js`: componente `<gamerzone-logo>` (scroll, luces, personaje animado, sonido).
- `gz-audio.js`: sonidos generados en el navegador.
- `gamerzone-logo.glb`: modelo con esqueleto (comprimido con Meshopt).
- `gamerzone-poster.webp`: imagen de respaldo mientras carga o sin WebGL.

Para probarlo localmente: `cd web && python servidor.py` y abrir http://localhost:8765

Para usarlo en otra página:

```html
<script type="module" src="gz-logo.js"></script>
<gamerzone-logo></gamerzone-logo>
```

## Blender

- `gamerzone-logo-3d.blend`: proyecto de Blender.
- `gz_relief.py`: siluetas, relieve y texturas del personaje a partir del arte HD.
- `gz_build_character.py`: construye el personaje en relieve en Blender.
- `gz_rig.py`: esqueleto y pesos del personaje.
- `gz_helpers.py`, `gz_compare.py`: utilidades.
