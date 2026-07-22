"""Generate logo.png and default-avatar.png for the miniapp."""
from PIL import Image, ImageDraw, ImageFont
import pathlib

out_dir = pathlib.Path(r'C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4\miniapp\images')
out_dir.mkdir(parents=True, exist_ok=True)

SIZE = 81
R = SIZE // 2  # 40


def make_circle(draw, center, radius, fill):
    draw.ellipse(
        [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius],
        fill=fill,
    )


# --- logo.png ---
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Blue circle
make_circle(draw, (R, R), R, '#1890ff')

# Draw "E" as white rectangles on the blue circle
cx, cy = R, R
letter_h = 32
letter_w = 22
sx = cx - letter_w // 2
sy = cy - letter_h // 2

# Vertical bar (left side of E)
draw.rectangle([sx, sy, sx + 5, sy + letter_h], fill='white')
# Top bar
draw.rectangle([sx, sy, sx + letter_w, sy + 5], fill='white')
# Middle bar
draw.rectangle([sx, sy + letter_h//2 - 2, sx + letter_w - 5, sy + letter_h//2 + 2], fill='white')
# Bottom bar
draw.rectangle([sx, sy + letter_h - 5, sx + letter_w, sy + letter_h], fill='white')

img.save(out_dir / 'logo.png')
print(f'logo.png saved: {out_dir / "logo.png"}')

# --- default-avatar.png ---
img2 = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw2 = ImageDraw.Draw(img2)

# Gray circle
make_circle(draw2, (R, R), R, '#cccccc')

# Head (white circle)
head_r = 14
head_cy = R - 8
make_circle(draw2, (R, head_cy), head_r, 'white')

# Shoulders / body (white ellipse)
body_top = head_cy + head_r + 4
body_bottom = R + 22
body_w = 34
draw2.ellipse([
    R - body_w//2, body_top,
    R + body_w//2, body_bottom
], fill='white')

img2.save(out_dir / 'default-avatar.png')
print(f'default-avatar.png saved: {out_dir / "default-avatar.png"}')
