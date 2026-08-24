"""Compose several identity references for an IP-Adapter input image."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageOps


def main() -> int:
    if len(sys.argv) < 4:
        return 2
    output = Path(sys.argv[1])
    sources = [Path(value) for value in sys.argv[2:4]]
    canvas = Image.new("RGB", (1024, 512), (245, 245, 242))
    for index, source in enumerate(sources):
        with Image.open(source) as image:
            fitted = ImageOps.contain(image.convert("RGB"), (500, 500), Image.Resampling.LANCZOS)
            x = index * 512 + (512 - fitted.width) // 2
            y = (512 - fitted.height) // 2
            canvas.paste(fitted, (x, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, format="PNG", optimize=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
