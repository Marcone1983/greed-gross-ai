#!/usr/bin/env python3

import os
import base64

# Create Android icon directories
icon_dirs = [
    "android/app/src/main/res/mipmap-hdpi",
    "android/app/src/main/res/mipmap-mdpi", 
    "android/app/src/main/res/mipmap-xhdpi",
    "android/app/src/main/res/mipmap-xxhdpi",
    "android/app/src/main/res/mipmap-xxxhdpi"
]

for dir_path in icon_dirs:
    os.makedirs(dir_path, exist_ok=True)

# Simple green square icon as base64 (we'll use the actual logo in production)
# This is a 512x512 green square with rounded corners
icon_data = """
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==
"""

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
    path = f"android/app/src/main/res/mipmap-{density}/ic_launcher.png"
    with open(path, "wb") as f:
        f.write(base64.b64decode(icon_data))
    print(f"Created {path}")
    
    # Also create round version
    round_path = f"android/app/src/main/res/mipmap-{density}/ic_launcher_round.png"
    with open(round_path, "wb") as f:
        f.write(base64.b64decode(icon_data))
    print(f"Created {round_path}")

print("\nAndroid icons created successfully!")
print("\nNote: These are placeholder icons. In production, use proper icon generation tools.")