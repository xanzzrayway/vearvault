import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Inisialisasi
size = 100
scale = 5  # Untuk scaling preview
img_size = size * scale
grid = np.random.randint(0, 2, size=(size, size, 3), dtype=np.uint8) * 255

# Buat image baru
image = Image.new("RGB", (img_size, img_size), "#f0f0f0")
draw = ImageDraw.Draw(image)

# Funktion buat draw grid titik
for i in range(size):
    for j in range(size):
        if grid[i, j].any() > 0:
            x = i * scale
            y = j * scale
            draw.rectangle([x, y, x + scale - 1, y + scale - 1], fill="#2c3e50")

# Buat title "BIDZ TOOLS" warna merah
try:
    font = ImageFont.truetype("arialbd.ttf", 24)
except:
    font = ImageFont.load_default()
draw.text((img_size//2 - 60, 10), "BIDZ TOOLS", fill="#e74c3c", font=font, ha="center")

# Buat progress bar keren
bar_width = img_size - 40
bar_height = 10
bar_pos = (20, img_size - 30)

# Background progressBar
draw.rectangle([bar_pos[0], bar_pos[1], bar_pos[0] + bar_width, bar_pos[1] + bar_height], 
               outline="#3498db", width=2)

# Fill progressBar (100%)
fill_width = bar_width
draw.rectangle([bar_pos[0], bar_pos[1], bar_pos[0] + fill_width, bar_pos[1] + bar_height], 
              fill="#2ecc71")

# Kasi shadow efek
# ... (efek tambahan bisa ditambah later)

# Tampilin dan simpan
image.show()
image.save("bidz_tools_dots.png")