import os

from cairosvg import svg2png

# Get the current directory
current_dir = os.path.dirname(os.path.abspath(__file__))

# Read the SVG file
with open(os.path.join(current_dir, "icon.svg"), "rb") as f:
    svg_content = f.read()

# Convert to different sizes
sizes = [192, 512]
for size in sizes:
    output_file = os.path.join(current_dir, f"icon-{size}.png")
    svg2png(
        bytestring=svg_content,
        write_to=output_file,
        output_width=size,
        output_height=size,
    )
