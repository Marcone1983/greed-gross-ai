#!/usr/bin/env python3

from PIL import Image
import os

# Open the logo
logo = Image.open('assets/logo.png')

# Ensure RGBA mode for transparency
if logo.mode != 'RGBA':
    logo = logo.convert('RGBA')

# Icon sizes for different densities
sizes = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192
}

# Create icons
for density, size in sizes.items():
    # Resize with antialiasing
    icon = logo.resize((size, size), Image.Resampling.LANCZOS)
    
    # Save standard icon
    path = f"android/app/src/main/res/mipmap-{density}/ic_launcher.png"
    icon.save(path, 'PNG')
    print(f"Created {path}")
    
    # Save round icon (same for now)
    round_path = f"android/app/src/main/res/mipmap-{density}/ic_launcher_round.png"
    icon.save(round_path, 'PNG')
    print(f"Created {round_path}")

print("\nApp icons created from logo.png!")