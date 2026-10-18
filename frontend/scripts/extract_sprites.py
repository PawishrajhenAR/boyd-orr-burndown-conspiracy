"""Cut the two 4x2 character expression sheets into transparent WebP sprites (numpy + Pillow only).

    python3 frontend/scripts/extract_sprites.py frontend/art/characters frontend/public/characters

Input:  <src>/mathew-sheet.png, <src>/morag-sheet.png (1672x941, 4x2 grid, label bar under each cell)
Output: <out>/<character>/<expression>.webp  (410x418, transparent, bottom-centre anchored)

Pipeline per cell:
  1. crop inside the black separators, dropping the label bar
  2. model the grey backdrop: luminance peak of low-saturation pixels, then a quadratic RGB surface
     fitted to the pixels that match it (handles soft gradients / vignetting)
  3. flood-fill "backdrop-like" pixels inward from the cell edges (grey inside the figure is protected)
  4. remove enclosed backdrop pockets (gaps between arm and body) with a strict test + morphological opening
  5. soft alpha on the boundary band from colour distance, then colour decontamination (no grey halo)
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

COLS = [(1, 416), (420, 833), (838, 1252), (1256, 1670)]
ROWS = [(1, 424), (470, 892)]
INSET = 3
CANVAS = (410, 418)  # every sprite is padded to this frame
NAMES = {
    'morag': ['neutral', 'curious', 'worried', 'surprised', 'sceptical', 'pointing', 'relieved', 'salute'],
    'mathew': ['thinking', 'explaining', 'examining', 'focus', 'aha', 'suspicious', 'determined', 'case-closed'],
}


def dilate(m: np.ndarray, r: int = 1) -> np.ndarray:
    for _ in range(r):
        o = m.copy()
        o[1:] |= m[:-1]
        o[:-1] |= m[1:]
        o[:, 1:] |= m[:, :-1]
        o[:, :-1] |= m[:, 1:]
        m = o
    return m


def erode(m: np.ndarray, r: int = 1) -> np.ndarray:
    return ~dilate(~m, r)


def backdrop_model(rgb: np.ndarray) -> np.ndarray:
    lum = rgb.mean(2)
    sat = rgb.max(2) - rgb.min(2)
    neutral = (sat < 9) & (lum > 60) & (lum < 220)
    hist, edges = np.histogram(lum[neutral], bins=160, range=(60, 220))
    peak = edges[hist.argmax()] + 0.5
    seed = neutral & (np.abs(lum - peak) < 12)
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w] / np.array([h, w])[:, None, None]
    feats = lambda y, x: np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], -1)
    A = feats(yy[seed], xx[seed])
    model = np.empty_like(rgb)
    F = feats(yy, xx).reshape(-1, 6)
    for ch in range(3):
        coef, *_ = np.linalg.lstsq(A, rgb[..., ch][seed], rcond=None)
        model[..., ch] = (F @ coef).reshape(h, w)
    return model


def cut(rgb: np.ndarray) -> tuple[np.ndarray, dict]:
    bg = backdrop_model(rgb)
    dist = np.sqrt(((rgb - bg) ** 2).sum(2))
    sat = rgb.max(2) - rgb.min(2)

    # 3. flood from the edges through backdrop-like pixels
    cand = (dist < 20) & (sat < 14)
    border = np.zeros_like(cand)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    grow = cand & border
    while True:
        nxt = dilate(grow) & cand
        if nxt.sum() == grow.sum():
            break
        grow = nxt

    # 4. enclosed pockets (e.g. between hair strands or arm and body): near the backdrop, >= ~5 px wide
    tight = (dist < 11) & (sat < 9)
    pockets = dilate(erode(tight, 2), 2) & tight
    pockets = dilate(pockets, 1) & cand
    # thin backdrop gaps between hair strands near the silhouette (any width), within 25 px of the outer backdrop
    halo_zone = dilate(grow, 25)
    pockets |= (dist < 10) & (sat < 8) & halo_zone
    background = grow | pockets

    # 5. local alpha matting in a 4 px band around the boundary:
    #    alpha = projection of (C - B) onto (F - B), where F = mean colour of solid foreground nearby
    fg = ~background
    band = dilate(fg, 4) & dilate(background, 4)
    solid = erode(fg, 2) & ~band
    def box(a, r=4):
        c = np.pad(a, ((r + 1, r), (r + 1, r)) + ((0, 0),) * (a.ndim - 2)).cumsum(0).cumsum(1)
        return c[2 * r + 1 :, 2 * r + 1 :] - c[: -2 * r - 1, 2 * r + 1 :] - c[2 * r + 1 :, : -2 * r - 1] + c[: -2 * r - 1, : -2 * r - 1]
    cnt = box(solid.astype(float))
    F = box(rgb * solid[..., None]) / np.maximum(cnt, 1)[..., None]
    FB = F - bg
    proj = ((rgb - bg) * FB).sum(2) / np.maximum((FB ** 2).sum(2), 1.0)
    fallback = np.clip((dist - 7.0) / (34.0 - 7.0), 0, 1)
    soft = np.where((cnt > 0) & ((FB ** 2).sum(2) > 400), np.clip(proj, 0, 1), fallback)
    # thin structures (antenna, single hairs): no solid foreground within 2 px -> plain distance alpha
    thin = box(solid.astype(float), 2) == 0
    soft = np.where(thin, np.clip((dist - 10.0) / (40.0 - 10.0), 0, 1), soft)
    alpha = fg.astype(float)
    alpha[band] = soft[band]
    alpha[background & ~band] = 0
    alpha[alpha < 0.04] = 0
    a = alpha[..., None]
    unmixed = np.clip(np.where(a > 0, (rgb - (1 - a) * bg) / np.maximum(a, 1e-3), 0), 0, 255)
    # soft edge pixels take their colour from the nearby solid foreground (no extrapolated bright wisps)
    use_local = (band & (alpha < 0.9) & (cnt > 0) & ~thin)[..., None]
    out = np.where(use_local, F, unmixed)
    rgba = np.dstack([out, alpha * 255]).round().astype(np.uint8)
    stats = {'pocket_px': int((pockets & ~grow).sum()), 'fg_ratio': round(float(alpha.mean()), 3), 'bg_rgb': bg.mean((0, 1)).round(1).tolist()}
    return rgba, stats


def main(src_dir: Path, out_dir: Path) -> None:
    report = {}
    for char, names in NAMES.items():
        im = np.asarray(Image.open(src_dir / f'{char}-sheet.png').convert('RGB')).astype(float)
        (out_dir / char).mkdir(parents=True, exist_ok=True)
        for i, name in enumerate(names):
            (y0, y1), (x0, x1) = ROWS[i // 4], COLS[i % 4]
            cell = im[y0 + INSET : y1 - INSET + 1, x0 + INSET : x1 - INSET + 1]
            rgba, stats = cut(cell)
            # common canvas so every sprite shares the same frame (anchor: bottom-centre)
            canvas = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
            sprite = Image.fromarray(rgba, 'RGBA')
            canvas.paste(sprite, ((CANVAS[0] - sprite.width) // 2, CANVAS[1] - sprite.height))
            canvas.save(out_dir / char / f'{name}.webp', 'WEBP', quality=92, alpha_quality=100, method=6)
            report[f'{char}/{name}'] = {**stats, 'size': list(CANVAS)}
            print(char, name, stats)
    print(json.dumps({'sprites': len(report)}))


if __name__ == '__main__':
    main(Path(sys.argv[1]), Path(sys.argv[2]))
