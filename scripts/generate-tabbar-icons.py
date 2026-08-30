from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw


SIZE = 81
SCALE = 4
STROKE = 4.2
INACTIVE = "#8B7E7A"
ACTIVE = "#D87263"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "src/static/icons/tabbar"


def scaled(value: float) -> int:
    return round(value * SCALE)


def box(values: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    return tuple(scaled(value) for value in values)


def points(values: list[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(scaled(x), scaled(y)) for x, y in values]


def draw_round_line(
    draw: ImageDraw.ImageDraw,
    values: list[tuple[float, float]],
    color: str,
    width: float = STROKE,
    *,
    closed: bool = False,
) -> None:
    path = points(values)
    if closed:
        path.append(path[0])
    line_width = scaled(width)
    draw.line(path, fill=color, width=line_width, joint="curve")

    radius = line_width / 2
    for x, y in (path[0], path[-1]):
        draw.ellipse(
            (round(x - radius), round(y - radius), round(x + radius), round(y + radius)),
            fill=color,
        )


def cubic(
    start: tuple[float, float],
    control_a: tuple[float, float],
    control_b: tuple[float, float],
    end: tuple[float, float],
    steps: int = 22,
) -> list[tuple[float, float]]:
    result: list[tuple[float, float]] = []
    for index in range(steps + 1):
        t = index / steps
        inverse = 1 - t
        x = (
            inverse**3 * start[0]
            + 3 * inverse**2 * t * control_a[0]
            + 3 * inverse * t**2 * control_b[0]
            + t**3 * end[0]
        )
        y = (
            inverse**3 * start[1]
            + 3 * inverse**2 * t * control_a[1]
            + 3 * inverse * t**2 * control_b[1]
            + t**3 * end[1]
        )
        result.append((x, y))
    return result


def heart_points(
    center_x: float,
    center_y: float,
    width: float,
    height: float,
    steps: int = 80,
) -> list[tuple[float, float]]:
    raw: list[tuple[float, float]] = []
    for index in range(steps):
        angle = 2 * math.pi * index / steps
        raw.append(
            (
                16 * math.sin(angle) ** 3,
                13 * math.cos(angle)
                - 5 * math.cos(2 * angle)
                - 2 * math.cos(3 * angle)
                - math.cos(4 * angle),
            )
        )

    min_x = min(x for x, _ in raw)
    max_x = max(x for x, _ in raw)
    min_y = min(y for _, y in raw)
    max_y = max(y for _, y in raw)
    return [
        (
            center_x + ((x - min_x) / (max_x - min_x) - 0.5) * width,
            center_y - ((y - min_y) / (max_y - min_y) - 0.5) * height,
        )
        for x, y in raw
    ]


def draw_heart(
    draw: ImageDraw.ImageDraw,
    center_x: float,
    center_y: float,
    width: float,
    height: float,
    color: str,
    *,
    filled: bool,
) -> None:
    heart = heart_points(center_x, center_y, width, height)
    if filled:
        draw.polygon(points(heart), fill=color)
    else:
        draw_round_line(draw, heart, color, 3.2, closed=True)


def draw_archive(draw: ImageDraw.ImageDraw, color: str, active: bool) -> None:
    line_width = scaled(STROKE)
    draw.rounded_rectangle(
        box((16, 23, 65, 66)),
        radius=scaled(8),
        outline=color,
        width=line_width,
    )
    draw_round_line(draw, [(18, 24), (23, 15), (58, 15), (63, 24)], color)
    draw_round_line(draw, [(17.5, 33), (63.5, 33)], color, 3.8)
    draw_heart(draw, 40.5, 49, 17, 15, color, filled=active)


def draw_calendar(draw: ImageDraw.ImageDraw, color: str, active: bool) -> None:
    line_width = scaled(STROKE)
    draw.rounded_rectangle(
        box((15, 19, 66, 66)),
        radius=scaled(9),
        outline=color,
        width=line_width,
    )
    draw_round_line(draw, [(16.5, 33), (64.5, 33)], color, 3.8)
    draw_round_line(draw, [(29, 13), (29, 25)], color)
    draw_round_line(draw, [(52, 13), (52, 25)], color)
    draw_heart(draw, 40.5, 50, 20, 17, color, filled=active)


def draw_insights(draw: ImageDraw.ImageDraw, color: str, active: bool) -> None:
    draw_round_line(draw, [(16, 17), (16, 64), (67, 64)], color)

    curve: list[tuple[float, float]] = []
    curve.extend(cubic((23, 52), (28, 50), (30, 36), (37, 36)))
    curve.extend(cubic((37, 36), (44, 35), (44, 47), (51, 42))[1:])
    curve.extend(cubic((51, 42), (57, 38), (59, 28), (65, 26))[1:])
    draw_round_line(draw, curve, color, 4)

    radius = scaled(3.2 if active else 2.5)
    center = (scaled(65), scaled(26))
    if active:
        draw.ellipse(
            (
                center[0] - radius,
                center[1] - radius,
                center[0] + radius,
                center[1] + radius,
            ),
            fill=color,
        )
    else:
        draw.ellipse(
            (
                center[0] - radius,
                center[1] - radius,
                center[0] + radius,
                center[1] + radius,
            ),
            fill="#FFFCF8",
            outline=color,
            width=scaled(1.8),
        )


def draw_profile(draw: ImageDraw.ImageDraw, color: str, active: bool) -> None:
    draw.ellipse(
        box((28.5, 13.5, 52.5, 37.5)),
        outline=color,
        width=scaled(STROKE),
    )

    shoulders = cubic((16, 66), (17, 50), (28, 43), (40.5, 43))
    shoulders.extend(cubic((40.5, 43), (53, 43), (64, 50), (65, 66))[1:])
    draw_round_line(draw, shoulders, color)
    draw_heart(draw, 61, 31, 15, 13, color, filled=active)


DRAWERS = {
    "archive": draw_archive,
    "create": draw_calendar,
    "insights": draw_insights,
    "profile": draw_profile,
}


def generate(name: str, active: bool) -> None:
    image = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    color = ACTIVE if active else INACTIVE
    DRAWERS[name](draw, color, active)

    image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    suffix = "-active" if active else ""
    image.save(OUTPUT_DIR / f"{name}{suffix}.png", optimize=True)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in DRAWERS:
        generate(name, False)
        generate(name, True)


if __name__ == "__main__":
    main()
