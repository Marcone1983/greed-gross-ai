#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os

# Dimensioni per ogni densità
sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
}

# Crea le directory se non esistono
base_path = 'android/app/src/main/res'

for folder in sizes.keys():
    os.makedirs(f"{base_path}/{folder}", exist_ok=True)

# Genera icone per ogni dimensione
for folder, size in sizes.items():
    # Crea immagine con sfondo trasparente
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Disegna foglia di cannabis stilizzata
    center = size // 2
    leaf_size = size * 0.8
    
    # Colore verde cannabis
    green = (46, 204, 64, 255)  # #2ECC40 con alpha
    
    # Disegna forma foglia semplificata (5 punte)
    points = []
    # Punta centrale in alto
    points.append((center, size * 0.1))
    # Punte laterali
    points.append((center - leaf_size * 0.4, size * 0.3))
    points.append((center - leaf_size * 0.3, size * 0.4))
    points.append((center - leaf_size * 0.4, size * 0.6))
    # Base
    points.append((center - leaf_size * 0.1, size * 0.8))
    points.append((center, size * 0.9))
    # Lato destro (simmetrico)
    points.append((center + leaf_size * 0.1, size * 0.8))
    points.append((center + leaf_size * 0.4, size * 0.6))
    points.append((center + leaf_size * 0.3, size * 0.4))
    points.append((center + leaf_size * 0.4, size * 0.3))
    
    # Disegna la foglia
    draw.polygon(points, fill=green)
    
    # Disegna linee centrali
    draw.line([(center, size * 0.9), (center, size * 0.2)], fill=green, width=max(2, size//48))
    draw.line([(center, size * 0.5), (center - leaf_size * 0.3, size * 0.3)], fill=green, width=max(1, size//72))
    draw.line([(center, size * 0.5), (center + leaf_size * 0.3, size * 0.3)], fill=green, width=max(1, size//72))
    draw.line([(center, size * 0.6), (center - leaf_size * 0.35, size * 0.5)], fill=green, width=max(1, size//72))
    draw.line([(center, size * 0.6), (center + leaf_size * 0.35, size * 0.5)], fill=green, width=max(1, size//72))
    
    # Salva icone
    img.save(f"{base_path}/{folder}/ic_launcher.png", 'PNG')
    img.save(f"{base_path}/{folder}/ic_launcher_round.png", 'PNG')

print("Icone generate con successo!")