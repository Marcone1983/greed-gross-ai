#!/bin/bash

# Genera icone da logo_original.png
BASE_DIR="android/app/src/main/res"
LOGO="logo_original.png"

# Funzione per generare icona con sfondo trasparente
generate_icon() {
    local size=$1
    local folder=$2
    
    echo "Generando icona ${size}x${size} per ${folder}..."
    
    # Ridimensiona il logo mantenendo trasparenza
    magick "$LOGO" \
        -resize ${size}x${size} \
        -background transparent \
        -gravity center \
        -extent ${size}x${size} \
        "${BASE_DIR}/${folder}/ic_launcher.png"
    
    # Copia per versione round (con maschera circolare)
    magick "$LOGO" \
        -resize ${size}x${size} \
        -background transparent \
        -gravity center \
        -extent ${size}x${size} \
        \( +clone -alpha extract \
           -draw "fill black polygon 0,0 0,$size $size,$size $size,0" \
           -blur 0x1 \
           -draw "fill white circle $((size/2)),$((size/2)) $((size/2)),0" \
        \) \
        -alpha off -compose CopyOpacity -composite \
        "${BASE_DIR}/${folder}/ic_launcher_round.png"
}

# Genera tutte le dimensioni
generate_icon 48 "mipmap-mdpi"
generate_icon 72 "mipmap-hdpi"
generate_icon 96 "mipmap-xhdpi"
generate_icon 144 "mipmap-xxhdpi"
generate_icon 192 "mipmap-xxxhdpi"

echo "Icone generate con successo!"