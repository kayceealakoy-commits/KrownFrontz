"""Remove edge-connected near-white background from logo PNGs."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

THRESHOLD = 248
ROOT = Path(__file__).resolve().parents[2]


def make_transparent(path: Path) -> None:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    visited = [[False] * w for _ in range(h)]

    def is_bg(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        return a > 0 and r >= THRESHOLD and g >= THRESHOLD and b >= THRESHOLD

    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg(x, y) and not visited[y][x]:
                q.append((x, y))
                visited[y][x] = True
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(x, y) and not visited[y][x]:
                q.append((x, y))
                visited[y][x] = True

    while q:
        x, y = q.popleft()
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx] and is_bg(nx, ny):
                visited[ny][nx] = True
                q.append((nx, ny))

    im.save(path, optimize=True)
    transparent = sum(1 for y in range(h) for x in range(w) if px[x, y][3] == 0)
    print(f"{path}: {transparent}/{w * h} transparent pixels")


def main() -> None:
    targets = [
        ROOT / "krown-frontz" / "assets" / "krown-frontz-logo.png",
        ROOT / "04-Krownfrontz.png",
    ]
    for target in targets:
        if target.exists():
            make_transparent(target)
        else:
            print(f"missing: {target}")


if __name__ == "__main__":
    main()
