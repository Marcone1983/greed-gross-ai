#!/bin/bash

# Download the logo and resize it for all icon sizes using ImageMagick
LOGO_URL="https://i.imgur.com/zkyXF7Y.png"

# Download logo
curl -o temp_logo.png "$LOGO_URL"

# Create icons for each density
# mdpi - 48x48
convert temp_logo.png -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher.png
cp android/app/src/main/res/mipmap-mdpi/ic_launcher.png android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png

# hdpi - 72x72
convert temp_logo.png -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher.png
cp android/app/src/main/res/mipmap-hdpi/ic_launcher.png android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png

# xhdpi - 96x96
convert temp_logo.png -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
cp android/app/src/main/res/mipmap-xhdpi/ic_launcher.png android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png

# xxhdpi - 144x144
convert temp_logo.png -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
cp android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png

# xxxhdpi - 192x192
convert temp_logo.png -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
cp android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png

# Clean up
rm temp_logo.png

echo "Icons created successfully!"