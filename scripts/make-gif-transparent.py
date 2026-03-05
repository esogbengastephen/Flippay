#!/usr/bin/env python3
"""Make white background transparent in a GIF. Requires: pip install Pillow"""
import sys
from pathlib import Path

try:
    from PIL import Image, ImageSequence
except ImportError:
    print("Installing Pillow...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "-q"])
    from PIL import Image, ImageSequence

def make_white_transparent(img, threshold=240):
    """Replace white/near-white pixels with transparent."""
    img = img.convert("RGBA")
    data = list(img.getdata())
    new_data = []
    for item in data:
        r, g, b, a = item
        if r >= threshold and g >= threshold and b >= threshold:
            new_data.append((r, g, b, 0))
        else:
            new_data.append(item)
    img.putdata(new_data)
    return img

def process_gif(input_path, output_path, threshold=240):
    img = Image.open(input_path)
    frames = []
    durations = []
    for frame in ImageSequence.Iterator(img):
        frame = frame.convert("RGBA")
        frame = make_white_transparent(frame.copy(), threshold)
        frames.append(frame)
        durations.append(frame.info.get("duration", 100))
    if frames:
        frames[0].save(
            output_path,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            disposal=2,
            transparency=0,
        )
        print(f"Saved: {output_path}")

if __name__ == "__main__":
    base = Path(__file__).resolve().parent.parent
    src = base / "asset" / "FlipPay gif [74EAE73].gif"
    dest = base / "public" / "asset" / "flippay-spinner.gif"
    if not src.exists():
        print(f"Source not found: {src}")
        sys.exit(1)
    dest.parent.mkdir(parents=True, exist_ok=True)
    process_gif(str(src), str(dest))
