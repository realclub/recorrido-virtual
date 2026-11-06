"""Descarga panoramas 360 de DEMO (Photo Sphere Viewer) y genera versiones 4096px + miniaturas.
Solo para maqueta: reemplazar por las fotos reales del club."""
import io, os, urllib.request
from PIL import Image

B = "https://photo-sphere-viewer-data.netlify.app/assets/"
SRC = {
    "asia-recepcion": "tour/key-biscayne-1.jpg",
    "asia-salon": "tour/key-biscayne-2.jpg",
    "asia-piscina": "tour/key-biscayne-3.jpg",
    "asia-restaurante": "tour/key-biscayne-4.jpg",
    "rp-ingreso": "tour/key-biscayne-5.jpg",
    "rp-clubhouse": "tour/key-biscayne-6.jpg",
    "rp-canchas": "tour/key-biscayne-7.jpg",
    "rp-terraza": "sphere.jpg",
}
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "panos")
os.makedirs(OUT, exist_ok=True)
for sid, path in SRC.items():
    data = urllib.request.urlopen(urllib.request.Request(B + path, headers={"User-Agent": "Mozilla/5.0"})).read()
    im = Image.open(io.BytesIO(data)).convert("RGB")
    im.resize((4096, 2048), Image.LANCZOS).save(os.path.join(OUT, f"{sid}.jpg"), quality=82, optimize=True, progressive=True)
    w, h = im.size  # miniatura: recorte central 3:2 del horizonte
    cw = int(h * 1.5); x0 = (w - cw) // 2
    th = im.crop((x0, int(h * 0.2), x0 + cw, int(h * 0.2) + int(cw / 1.5) if int(h*0.2)+int(cw/1.5) <= h else h)).resize((900, 600), Image.LANCZOS)
    th.save(os.path.join(OUT, f"{sid}-thumb.jpg"), quality=80, optimize=True)
    print("ok", sid, im.size)
