"""Optional icon source generator. Release builds use the committed assets."""
from pathlib import Path
from PIL import Image, ImageDraw

size, scale = 256, 4
image = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
def coords(values):
    return tuple(round(value * scale) for value in values)
draw.rounded_rectangle(coords((0, 0, 255, 255)), radius=68 * scale, fill="#264b3c")
draw.arc(coords((50, 47, 206, 203)), 150, 390, fill="#dce9ce", width=18 * scale)
draw.line(coords((128, 146, 178, 83)), fill="#dce9ce", width=16 * scale)
draw.ellipse(coords((108, 126, 148, 166)), fill="#dce9ce")
image = image.resize((size, size), Image.Resampling.LANCZOS)
output = Path(__file__).resolve().parents[1] / "public"
image.save(output / "icon.png")
image.save(output / "icon.ico", sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
