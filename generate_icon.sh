#!/bin/bash

# Genera icona con logo cannabis su sfondo trasparente
# Usa un emoji come base temporanea

BASE_DIR="android/app/src/main/res"

# Funzione per generare icona per una dimensione specifica
generate_icon() {
    local size=$1
    local folder=$2
    
    echo "Generando icona ${size}x${size} per ${folder}..."
    
    # Crea una immagine con sfondo trasparente e testo emoji
    convert -size ${size}x${size} xc:transparent \
        -gravity center \
        -font DejaVu-Sans \
        -pointsize $((size * 70 / 100)) \
        -fill '#2ECC40' \
        -annotate +0+0 '🌿' \
        "${BASE_DIR}/${folder}/ic_launcher.png"
    
    # Copia per versione round
    cp "${BASE_DIR}/${folder}/ic_launcher.png" "${BASE_DIR}/${folder}/ic_launcher_round.png"
}

# Genera icone per tutte le densità
generate_icon 48 "mipmap-mdpi"
generate_icon 72 "mipmap-hdpi"
generate_icon 96 "mipmap-xhdpi"
generate_icon 144 "mipmap-xxhdpi"
generate_icon 192 "mipmap-xxxhdpi"

echo "Icone generate con successo!"