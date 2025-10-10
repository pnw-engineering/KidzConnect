import os
import subprocess

# Get the current directory
current_dir = os.path.dirname(os.path.abspath(__file__))
svg_file = os.path.join(current_dir, "icon.svg")

# Check if Inkscape is installed and get its path
inkscape_paths = [
    r"C:\Program Files\Inkscape\bin\inkscape.exe",
    r"C:\Program Files (x86)\Inkscape\bin\inkscape.exe",
]
inkscape_exe = None
for path in inkscape_paths:
    if os.path.exists(path):
        inkscape_exe = path
        break

if inkscape_exe is None:
    print("Please install Inkscape from https://inkscape.org/release/")
    print("It's needed to properly convert the SVG with fonts to PNG")
    exit(1)

# Convert SVG to different PNG sizes
sizes = [192, 512]
for size in sizes:
    output_file = os.path.join(current_dir, f"icon-{size}.png")
    subprocess.run(
        [
            inkscape_exe,
            "--export-filename",
            output_file,
            "-w",
            str(size),
            "-h",
            str(size),
            svg_file,
        ],
        check=True,
    )
