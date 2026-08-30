from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw


SIZE = 81
SCALE = 4
STROKE = 4.1
INACTIVE = "#8B7E7A"
ACTIVE = "#D87263"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "src/static/icons/anniversary-kinds"


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
        result.append(
            (
                inverse**3 * start[0]
                + 3 * inverse**2 * t * control_a[0]
                + 3 * inverse * t**2 * control_b[0]
                + t**3 * end[0],
                inverse**3 * start[1]
                + 3 * inverse**2 * t * control_a[1]
                + 3 * inverse * t**2 * control_b[1]
                + t**3 * end[1],
            )
        )
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
        draw_round_line(draw, heart, color, 3, closed=True)


def sparkle_points(
    center_x: float,
    center_y: float,
    radius: float,
    inner_radius: float,
) -> list[tuple[float, float]]:
    result: list[tuple[float, float]] = []
    for index in range(8):
        angle = -math.pi / 2 + index * math.pi / 4
        distance = radius if index % 2 == 0 else inner_radius
        result.append(
            (
                center_x + math.cos(angle) * distance,
                center_y + math.sin(angle) * distance,
            )
        )
    return result


def draw_sparkle(
    draw: ImageDraw.ImageDraw,
    center_x: float,
    center_y: float,
    radius: float,
    color: str,
    *,
    filled: bool,
) -> None:
    sparkle = sparkle_points(center_x, center_y, radius, radius * 0.34)
    if filled:
        draw.polygon(points(sparkle), fill=color)
    else:
        draw_round_line(draw, sparkle, color, 2.8, closed=True)


def draw_relationship(draw: ImageDraw.ImageDraw, color: str, active: bool) -> None:
    line_width = scaled(STROKE)
    draw.ellipse(box((13, 30, 46, 63)), outline=color, width=line_width)
    draw.ellipse(box((35, 30, 68, 63)), outline=color, width=line_width)
    draw_heart(draw, 40.5, 24, 15, 13, color, filled=active)


def draw_birthday(draw: ImageDraw.ImageDraw, color: str, active: bool) -> None:
    line_width = scaled(STROKE)
    draw.rounded_rectangle(
        box((14, 36, 67, 66)),
        radius=scaled(7),
        outline=color,
        width=line_width,
    )
    frosting: list[tuple[float, float]] = []
    frosting.extend(cubic((16, 44), (22, 38), (27, 49), (34, 43)))
    frosting.extend(cubic((34, 43), (40, 37), (46, 49), (52, 43))[1:])
    frosting.extend(cubic((52, 43), (57, 39), (61, 44), (65, 43))[1:])
    draw_round_line(draw, frosting, color, 3.4)
    draw_round_line(draw, [(18, 55), (63, 55)], color, 3.2)
    candles = [
        (28.5, 25),
        (40.5, 20),
        (52.5, 25),
    ]
    for center_x, candle_top in candles:
        draw.rounded_rectangle(
            box((center_x - 2.8, candle_top, center_x + 2.8, 36)),
            radius=scaled(2),
            outline=color,
            width=scaled(2.6),
        )
        flame = [
            (center_x, candle_top - 2),
            (center_x - 2.4, candle_top - 5),
            (center_x, candle_top - 10),
            (center_x + 2.4, candle_top - 5),
        ]
        if active:
            draw.polygon(points(flame), fill=color)
        else:
            draw_round_line(draw, flame, color, 2.2, closed=True)


def draw_first_met(draw: ImageDraw.ImageDraw, color: str, active: bool) -> None:
    pin: list[tuple[float, float]] = []
    pin.extend(cubic((40.5, 69), (35, 61), (19, 48), (19, 33)))
    pin.extend(cubic((19, 33), (19, 20), (28.5, 13), (40.5, 13))[1:])
    pin.extend(cubic((40.5, 13), (52.5, 13), (62, 20), (62, 33))[1:])
    pin.extend(cubic((62, 33), (62, 48), (46, 61), (40.5, 69))[1:])
    draw_round_line(draw, pin, color, closed=True)
    draw_sparkle(draw, 40.5, 33, 11, color, filled=active)


def draw_custom(draw: ImageDraw.ImageDraw, color: str, active: bool) -> None:
    draw_round_line(draw, [(19, 63), (49, 33)], color, 6)
    draw_round_line(draw, [(25, 57), (31, 63)], color, 2.8)
    draw_sparkle(draw, 57, 24, 12, color, filled=active)

    dot_radius = scaled(2.6)
    for center_x, center_y in ((24, 22), (64, 47)):
        center = (scaled(center_x), scaled(center_y))
        draw.ellipse(
            (
                center[0] - dot_radius,
                center[1] - dot_radius,
                center[0] + dot_radius,
                center[1] + dot_radius,
            ),
            fill=color if active else None,
            outline=None if active else color,
            width=scaled(1.8),
        )


DRAWERS = {
    "relationship": draw_relationship,
    "birthday": draw_birthday,
    "first-met": draw_first_met,
    "custom": draw_custom,
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
