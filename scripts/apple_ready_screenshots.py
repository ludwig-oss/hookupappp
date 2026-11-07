"""Fit cleaned screenshots into Apple's 6.7-inch frame: exactly 1290x2796."""

from pathlib import Path

from PIL import Image, ImageCms

ROOT = Path(__file__).resolve().parents[1]
SHOT_DIR = ROOT / "assets" / "apple-screenshots"
TARGET = (1290, 2796)
BLACK = (0, 0, 0)

NAMES = {
    "hookup-screen-login.png": "apple-ready-login.png",
    "hookup-screen-connections.png": "apple-ready-connections.png",
    "hookup-screen-nearby.png": "apple-ready-nearby.png",
}


def srgb_profile_bytes() -> bytes:
    profile = ImageCms.createProfile("sRGB")
    return ImageCms.ImageCmsProfile(profile).tobytes()


def fit_frame(image: Image.Image) -> Image.Image:
    image.load()
    pixels = image.convert("RGB")
    width, height = pixels.size
    scale = min(TARGET[0] / width, TARGET[1] / height)
    fitted_w = min(TARGET[0], max(1, round(width * scale)))
    fitted_h = min(TARGET[1], max(1, round(height * scale)))
    fitted = pixels.resize((fitted_w, fitted_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", TARGET, BLACK)
    canvas.paste(fitted, ((TARGET[0] - fitted_w) // 2, (TARGET[1] - fitted_h) // 2))
    # Rebuild so only pixels and the sRGB profile are stored.
    return Image.frombytes("RGB", canvas.size, canvas.tobytes())


def main() -> None:
    icc = srgb_profile_bytes()
    missing = [name for name in NAMES if not (SHOT_DIR / name).is_file()]
    if missing:
        raise SystemExit("Missing screenshots:\n" + "\n".join(missing))

    for source_name, dest_name in NAMES.items():
        source = SHOT_DIR / source_name
        dest = SHOT_DIR / dest_name
        with Image.open(source) as image:
            original = image.size
            ready = fit_frame(image)
        if ready.size != TARGET:
            raise SystemExit(f"{dest_name} is {ready.size}, expected {TARGET}")
        dest.parent.mkdir(parents=True, exist_ok=True)
        ready.save(dest, format="PNG", icc_profile=icc, compress_level=3)
        with Image.open(dest) as saved:
            saved.load()
            leftover = [key for key in saved.info if key != "icc_profile"]
            if saved.size != TARGET or leftover or "icc_profile" not in saved.info:
                raise SystemExit(f"{dest_name} failed check: {saved.size} {saved.info.keys()}")
            print(
                f"{source_name} {original[0]}x{original[1]} -> "
                f"{dest_name} {saved.size[0]}x{saved.size[1]}"
            )


if __name__ == "__main__":
    main()
