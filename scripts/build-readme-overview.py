from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path("/Users/jino/study/project/resume-tailor")
FRAMES = {
    "STEP 1": ROOT / "tmp/readme-gif-build/frames/step1-04.png",
    "STEP 2": ROOT / "tmp/readme-gif-build/frames/step2-04.png",
    "STEP 3": ROOT / "tmp/readme-gif-build/frames/step3-03.png",
    "STEP 4": ROOT / "tmp/readme-gif-build/frames/step4-04.png",
}
OUTPUT = ROOT / "docs/images/app-flow-overview.png"

CARD_WIDTH = 860
CARD_HEIGHT = 540
PADDING = 48
GAP = 32
HEADER_HEIGHT = 150
CANVAS_WIDTH = PADDING * 2 + CARD_WIDTH * 2 + GAP
CANVAS_HEIGHT = PADDING * 2 + HEADER_HEIGHT + CARD_HEIGHT * 2 + GAP + 20


def load_font(size: int, bold: bool = False):
    candidates = [
        "/System/Library/Fonts/Supplemental/AppleSDGothicNeo.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def fit_cover(image: Image.Image, width: int, height: int) -> Image.Image:
    src_w, src_h = image.size
    scale = max(width / src_w, height / src_h)
    resized = image.resize((int(src_w * scale), int(src_h * scale)), Image.Resampling.LANCZOS)
    left = max((resized.width - width) // 2, 0)
    top = max((resized.height - height) // 2, 0)
    return resized.crop((left, top, left + width, top + height))


def rounded_mask(width: int, height: int, radius: int) -> Image.Image:
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, width, height), radius=radius, fill=255)
    return mask


def paste_card(canvas: Image.Image, label: str, frame_path: Path, x: int, y: int, title_font, body_font):
    draw = ImageDraw.Draw(canvas)
    shadow_color = (211, 205, 193, 90)
    card_color = (255, 252, 246, 255)
    border_color = (222, 216, 204, 255)
    caption_color = (85, 82, 73, 255)
    step_color = (53, 83, 188, 255)
    radius = 24

    shadow_box = (x + 6, y + 10, x + CARD_WIDTH + 6, y + CARD_HEIGHT + 10)
    draw.rounded_rectangle(shadow_box, radius=radius, fill=shadow_color)
    card_box = (x, y, x + CARD_WIDTH, y + CARD_HEIGHT)
    draw.rounded_rectangle(card_box, radius=radius, fill=card_color, outline=border_color, width=2)

    header_y = y + 22
    draw.text((x + 28, header_y), label, font=title_font, fill=step_color)
    draw.text((x + 150, header_y + 2), "ResumeTailor", font=body_font, fill=caption_color)

    image_area = (x + 24, y + 64, x + CARD_WIDTH - 24, y + CARD_HEIGHT - 24)
    frame = Image.open(frame_path).convert("RGB")
    fitted = fit_cover(frame, image_area[2] - image_area[0], image_area[3] - image_area[1])
    mask = rounded_mask(fitted.width, fitted.height, 18)
    canvas.paste(fitted, (image_area[0], image_area[1]), mask)


def main():
    for frame in FRAMES.values():
      if not frame.exists():
          raise FileNotFoundError(f"missing frame: {frame}")

    canvas = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT), (247, 243, 236, 255))
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(56, bold=True)
    section_font = load_font(32, bold=True)
    body_font = load_font(24)
    small_font = load_font(22)

    draw.text((PADDING, PADDING), "ResumeTailor Workflow", font=title_font, fill=(37, 35, 30, 255))
    draw.text(
        (PADDING, PADDING + 72),
        "step 1부터 step 4까지 실제 화면 흐름을 한 장으로 정리한 overview 이미지입니다.",
        font=body_font,
        fill=(92, 88, 80, 255),
    )

    positions = [
        (PADDING, PADDING + HEADER_HEIGHT),
        (PADDING + CARD_WIDTH + GAP, PADDING + HEADER_HEIGHT),
        (PADDING, PADDING + HEADER_HEIGHT + CARD_HEIGHT + GAP),
        (PADDING + CARD_WIDTH + GAP, PADDING + HEADER_HEIGHT + CARD_HEIGHT + GAP),
    ]

    for (label, frame_path), (x, y) in zip(FRAMES.items(), positions):
        paste_card(canvas, label, frame_path, x, y, section_font, small_font)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUTPUT, quality=92)
    print(OUTPUT)


if __name__ == "__main__":
    main()
