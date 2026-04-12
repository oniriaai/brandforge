import base64
import hashlib
import re
from typing import Any

import svgwrite
from opensimplex import OpenSimplex

HEX_COLOR_PATTERN = re.compile(r"^#([A-Fa-f0-9]{6})$")
LAYER_KIND_CYCLE = ["circle", "ring", "mesh", "beam"]

DENSITY_CONFIG: dict[str, dict[str, float]] = {
    "minimal": {
        "blob_count": 4,
        "mesh_rows": 2,
        "noise_scale": 0.16,
        "size_min_factor": 0.11,
        "size_max_factor": 0.24,
        "opacity_min": 0.14,
        "opacity_max": 0.3,
        "texture_opacity": 0.24,
    },
    "balanced": {
        "blob_count": 6,
        "mesh_rows": 3,
        "noise_scale": 0.19,
        "size_min_factor": 0.12,
        "size_max_factor": 0.28,
        "opacity_min": 0.16,
        "opacity_max": 0.34,
        "texture_opacity": 0.3,
    },
    "expressive": {
        "blob_count": 8,
        "mesh_rows": 4,
        "noise_scale": 0.22,
        "size_min_factor": 0.14,
        "size_max_factor": 0.32,
        "opacity_min": 0.18,
        "opacity_max": 0.38,
        "texture_opacity": 0.36,
    },
}


def _hex_to_rgb(value: str, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    if not isinstance(value, str) or not HEX_COLOR_PATTERN.match(value):
        return fallback
    return tuple(int(value[i : i + 2], 16) for i in (1, 3, 5))


def _rgb(color: str, *, fallback: tuple[int, int, int]) -> str:
    r, g, b = _hex_to_rgb(color, fallback)
    return f"rgb({r}, {g}, {b})"


def _to_number(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _scale_noise(value: float, minimum: float, maximum: float) -> float:
    normalized = (value + 1.0) / 2.0
    return minimum + normalized * (maximum - minimum)


def build_procedural_seed(
    *,
    post_id: str,
    variant_index: int,
    revision_of_job_id: str | None = None,
) -> int:
    seed_source = f"{post_id}|{variant_index}|{revision_of_job_id or 'base'}"
    digest = hashlib.sha256(seed_source.encode("utf-8")).hexdigest()
    return int(digest[:15], 16)


def generate_procedural_background(
    *,
    width: int,
    height: int,
    primary_color: str,
    secondary_color: str,
    accent_color: str,
    seed: int,
    density: str = "balanced",
) -> dict[str, Any]:
    config = DENSITY_CONFIG.get(density, DENSITY_CONFIG["balanced"])
    blob_count = int(config["blob_count"])
    mesh_rows = int(config["mesh_rows"])
    noise_scale = float(config["noise_scale"])

    noise = OpenSimplex(seed=int(seed))
    drawing = svgwrite.Drawing(size=(width, height), profile="full")

    gradient = drawing.linearGradient(start=(0, 0), end=(1, 1), id=f"bg-gradient-{seed}")
    gradient.add_stop_color(offset=0, color=primary_color)
    gradient.add_stop_color(offset=1, color=secondary_color)
    drawing.defs.add(gradient)
    drawing.add(drawing.rect(insert=(0, 0), size=(width, height), fill=gradient.get_paint_server()))

    palette = [accent_color, primary_color, secondary_color]
    fallback_rgb = (79, 70, 229)
    decorative_layers: list[dict[str, Any]] = []

    min_canvas = min(width, height)
    min_size = min_canvas * float(config["size_min_factor"])
    max_size = min_canvas * float(config["size_max_factor"])
    min_opacity = float(config["opacity_min"])
    max_opacity = float(config["opacity_max"])

    for index in range(blob_count):
        offset = index + 1
        nx = noise.noise2(offset * noise_scale, 0.13)
        ny = noise.noise2(0.29, offset * noise_scale)
        ns = noise.noise2(offset * noise_scale, offset * noise_scale)
        no = noise.noise2(0.67 + offset * noise_scale, 0.91 + offset * noise_scale)
        x = _scale_noise(nx, min_size * 0.6, width - min_size * 0.6)
        y = _scale_noise(ny, min_size * 0.6, height - min_size * 0.6)
        size = _scale_noise(ns, min_size, max_size)
        opacity = _scale_noise(no, min_opacity, max_opacity)
        color = palette[index % len(palette)]

        drawing.add(
            drawing.circle(
                center=(round(x, 2), round(y, 2)),
                r=round(size / 2, 2),
                fill=_rgb(color, fallback=fallback_rgb),
                fill_opacity=round(opacity, 4),
            )
        )

        decorative_layers.append(
            {
                "kind": LAYER_KIND_CYCLE[index % len(LAYER_KIND_CYCLE)],
                "color": color,
                "opacity": round(min(0.52, opacity + 0.14), 3),
                "size": round(size, 2),
                "x": round(x, 2),
                "y": round(y, 2),
            }
        )

    for row in range(mesh_rows):
        points: list[tuple[float, float]] = []
        y_base = (row + 1) * height / (mesh_rows + 1)
        for segment in range(13):
            x_pos = (segment / 12) * width
            wobble = noise.noise2((row + 1) * 0.77, segment * noise_scale)
            y_pos = y_base + wobble * (height * 0.06)
            points.append((round(x_pos, 2), round(y_pos, 2)))
        drawing.add(
            drawing.polyline(
                points=points,
                fill="none",
                stroke=_rgb(accent_color, fallback=fallback_rgb),
                stroke_opacity=round(0.2 + row * 0.03, 4),
                stroke_width=1.6 + (row * 0.3),
            )
        )

    svg_text = drawing.tostring()
    data_uri = f"data:image/svg+xml;base64,{base64.b64encode(svg_text.encode('utf-8')).decode('ascii')}"

    return {
        "source": "procedural_svg",
        "seed": int(seed),
        "noiseScale": round(noise_scale, 4),
        "octaves": 1,
        "textureOpacity": round(_to_number(config.get("texture_opacity"), 0.3), 3),
        "svgDataUri": data_uri,
        "decorativeLayers": decorative_layers,
    }


__all__ = [
    "build_procedural_seed",
    "generate_procedural_background",
]
