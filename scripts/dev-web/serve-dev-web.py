"""Liefert die Dev-Web-Vorschau (Vite-Build) auf Port 8090 aus."""
import os

from flask import Flask, abort, send_from_directory

WEB_ROOT = r"C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox-dev-web"
HOST = "0.0.0.0"
PORT = 8090

app = Flask(__name__, static_folder=None)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    # Versteckte Pfade (z. B. .git/...) nie ausliefern
    if any(part.startswith(".") for part in path.replace("\\", "/").split("/")):
        abort(404)
    full = os.path.join(WEB_ROOT, path)
    if path and os.path.isfile(full):
        return send_from_directory(WEB_ROOT, path)
    # SPA-Routing: unbekannte Pfade -> index.html
    return send_from_directory(WEB_ROOT, "index.html")


if __name__ == "__main__":
    app.run(host=HOST, port=PORT)
