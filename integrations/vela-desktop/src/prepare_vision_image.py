"""Create a bounded JPEG copy for local vision-model review."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageOps


def main() -> int:
    if len(sys.argv) != 4:
        return 2
    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    max_side = max(256, min(1600, int(sys.argv[3])))
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        output.parent.mkdir(parents=True, exist_ok=True)
        image.save(output, format="JPEG", quality=88, optimize=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
