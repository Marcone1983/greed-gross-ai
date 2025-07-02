#!/usr/bin/env python3

import base64
import os

# Simple script to copy logo to all Android icon locations
# In production, use proper image resizing tools

logo_path = "assets/logo.png"

# Icon sizes for different densities
sizes = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192
}

# Read the logo file
if os.path.exists(logo_path):
    with open(logo_path, "rb") as f:
        logo_data = f.read()
    
    # Create icons by copying the logo (not ideal but works for now)
    for density, size in sizes.items():
        # Standard icon
        path = f"android/app/src/main/res/mipmap-{density}/ic_launcher.png"
        with open(path, "wb") as f:
            f.write(logo_data)
        print(f"Created {path}")
        
        # Round icon
        round_path = f"android/app/src/main/res/mipmap-{density}/ic_launcher_round.png"
        with open(round_path, "wb") as f:
            f.write(logo_data)
        print(f"Created {round_path}")
    
    print("\nApp icons created from logo.png!")
    print("Note: For production, use proper image resizing tools.")
else:
    print(f"Error: {logo_path} not found!")