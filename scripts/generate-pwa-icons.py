"""Generate committed PWA PNG icons from the geometry in client/public/icon.svg.

Requires Pillow. The 4x render is downsampled for antialiased platform assets.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "client" / "public" / "icons"
SCALE = 4


def point(value: float, size: int, inset: float) -> int:
    return round((inset + value * (1 - 2 * inset)) * size * SCALE)


def render(size: int, inset: float) -> Image.Image:
    canvas = size * SCALE
    image = Image.new("RGB", (canvas, canvas), "#e3eee9")
    draw = ImageDraw.Draw(image)

    # A restrained mineral gradient keeps the icon legible on light/dark wallpaper.
    top = (246, 250, 247)
    bottom = (201, 223, 214)
    for y in range(canvas):
        ratio = y / max(canvas - 1, 1)
        color = tuple(round(a + (b - a) * ratio) for a, b in zip(top, bottom))
        draw.line((0, y, canvas, y), fill=color)

    box = tuple(point(value, size, inset) for value in (0.242, 0.205, 0.758, 0.795))
    radius = point(0.125, size, inset) - point(0, size, inset)
    draw.rounded_rectangle(box, radius=radius, fill="#285d52")

    line_width = max(4, round(size * SCALE * (1 - 2 * inset) * 0.043))
    for x in (0.371, 0.629):
        draw.line(
            (point(x, size, inset), point(0.182, size, inset), point(x, size, inset), point(0.276, size, inset)),
            fill="#173f35",
            width=line_width,
        )

    content_width = max(4, round(size * SCALE * (1 - 2 * inset) * 0.042))
    for y, end in ((0.379, 0.646), (0.477, 0.646), (0.574, 0.518)):
        draw.line(
            (point(0.354, size, inset), point(y, size, inset), point(end, size, inset), point(y, size, inset)),
            fill="#f6faf7",
            width=content_width,
        )

    center = (point(0.642, size, inset), point(0.656, size, inset))
    radius = max(8, round(size * SCALE * (1 - 2 * inset) * 0.111))
    draw.ellipse((center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius), fill="#c6f06a")
    check_width = max(3, round(size * SCALE * (1 - 2 * inset) * 0.035))
    draw.line(
        (
            point(0.590, size, inset), point(0.658, size, inset),
            point(0.625, size, inset), point(0.693, size, inset),
            point(0.699, size, inset), point(0.609, size, inset),
        ),
        fill="#173f35",
        width=check_width,
        joint="curve",
    )
    return image.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for filename, size, inset in (
        ("apple-touch-icon-180.png", 180, 0.02),
        ("icon-192.png", 192, 0.02),
        ("icon-512.png", 512, 0.02),
        ("icon-maskable-192.png", 192, 0.12),
        ("icon-maskable-512.png", 512, 0.12),
    ):
        render(size, inset).save(OUTPUT / filename, format="PNG", optimize=True)


if __name__ == "__main__":
    main()
