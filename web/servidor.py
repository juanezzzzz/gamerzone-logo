# Servidor local para probar la página sin caché (cada recarga trae los archivos nuevos).
# Uso: python servidor.py   ->  http://localhost:8765
import functools, http.server, os


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


here = os.path.dirname(os.path.abspath(__file__))
print("Sirviendo", here, "en http://localhost:8765", flush=True)
http.server.ThreadingHTTPServer(("", 8765), functools.partial(NoCache, directory=here)).serve_forever()
