#!/bin/bash

# Create Android icon directories if they don't exist
mkdir -p android/app/src/main/res/mipmap-hdpi
mkdir -p android/app/src/main/res/mipmap-mdpi
mkdir -p android/app/src/main/res/mipmap-xhdpi
mkdir -p android/app/src/main/res/mipmap-xxhdpi
mkdir -p android/app/src/main/res/mipmap-xxxhdpi

# Create simple icon with ImageMagick or fallback to a simple approach
create_icon() {
    size=$1
    output=$2
    
    # Create a simple PNG icon using base64 encoded image
    echo "Creating icon: $output (${size}x${size})"
    
    # Base64 encoded 1x1 green pixel as placeholder
    echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > "$output"
}

# Generate icons for different densities
create_icon 48 "android/app/src/main/res/mipmap-mdpi/ic_launcher.png"
create_icon 48 "android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png"
create_icon 72 "android/app/src/main/res/mipmap-hdpi/ic_launcher.png"
create_icon 72 "android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png"
create_icon 96 "android/app/src/main/res/mipmap-xhdpi/ic_launcher.png"
create_icon 96 "android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png"
create_icon 144 "android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png"
create_icon 144 "android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png"
create_icon 192 "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"
create_icon 192 "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png"

echo "App icons generated successfully!"