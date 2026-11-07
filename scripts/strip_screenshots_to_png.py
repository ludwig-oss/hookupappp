"""Load dropped screenshots, drop web metadata, save sRGB PNGs."""

from pathlib import Path

from PIL import Image, ImageCms

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "apple-screenshots"

# The three screenshots attached in this session.
SOURCES = [
    Path(r"C:\Users\luigr\.cursor\projects\c-Users-luigr-aswp\assets\hookup_screen_1_5244x2950-de0a013d-8b05-45da-a37b-129d4e9dc84d.jpg"),
    Path(r"C:\Users\luigr\.cursor\projects\c-Users-luigr-aswp\assets\hookup_screen_2_5244x2950-6732133e-4b7b-4906-99db-566dc343ddd8.jpg"),
    Path(r"C:\Users\luigr\.cursor\projects\c-Users-luigr-aswp\assets\hookup_screen_3_5244x2950-b14c7883-31ea-41ee-b103-7cf7d50dec4f.jpg"),
]

NAMES = {
    "hookup_screen_1": "hookup-screen-login.png",
    "hookup_screen_2": "hookup-screen-connections.png",
    "hookup_screen_3": "hookup-screen-nearby.png",
}


def srgb_profile_bytes() -> bytes:
    """sRGB IEC 61966-2-1, the standard display profile Apple accepts."""
    profile = ImageCms.createProfile("sRGB")
    return ImageCms.ImageCmsProfile(profile).tobytes()


def metadata_keys(image: Image.Image) -> list[str]:
    keys = sorted(image.info.keys())
    extra = []
    if getattr(image, "getexif", None) and image.getexif():
        extra.append(f"exif:{len(image.getexif())}")
    return keys + extra


def to_clean_png(src: Path, dest: Path, icc: bytes) -> None:
    with Image.open(src) as image:
        image.load()
        before = metadata_keys(image)
        mode = "RGBA" if "A" in image.getbands() else "RGB"
        pixels = image.convert(mode)
        # Rebuild from raw pixels so EXIF, XMP, IPTC, and text chunks are gone.
        clean = Image.frombytes(mode, pixels.size, pixels.tobytes())

    dest.parent.mkdir(parents=True, exist_ok=True)
    clean.save(dest, format="PNG", icc_profile=icc, compress_level=3)

    with Image.open(dest) as saved:
        saved.load()
        after = metadata_keys(saved)
        leftover = [key for key in after if key != "icc_profile"]
        if leftover or "icc_profile" not in saved.info:
            raise SystemExit(f"{dest.name} still has unexpected metadata: {after}")
        print(
            f"{src.name} -> {dest.relative_to(ROOT)} "
            f"{saved.size[0]}x{saved.size[1]} {saved.mode} "
            f"stripped={before or ['none']} kept={after}"
        )


def main() -> None:
    icc = srgb_profile_bytes()
    missing = [path for path in SOURCES if not path.is_file()]
    if missing:
        raise SystemExit("Missing screenshots:\n" + "\n".join(str(path) for path in missing))
    for src in SOURCES:
        stem = src.name.split("_5244")[0]
        dest = OUT_DIR / NAMES.get(stem, f"{stem}.png")
        to_clean_png(src, dest, icc)


if __name__ == "__main__":
    main()
