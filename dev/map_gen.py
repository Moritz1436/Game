import numpy as np
from PIL import Image
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
import noise
import os

class LandscapeGenerator:
    def __init__(self, width, height):
        """
        Initialisiert den Landscape Generator
        
        Args:
            width: Breite des Bildes in Pixeln
            height: Höhe des Bildes in Pixeln
        """
        self.width = width
        self.height = height
        self.terrain = None
        self.biome_map = None
        
        # Biome Definitionen mit Farben (RGB)
        self.biomes = {
            'wasser': {
                'color': (30, 144, 255),
                'height_range': (-0.2, 0.3),  # VON 0.15 AUF 0.25 erhöht = MEHR WASSER
                'name': 'Wasser'
            },
            'wüste': {
                'color': (194, 178, 128),
                'height_range': (0.20, 0.35),  # VERSCHOBEN für mehr Wüste
                'name': 'Wüste'
            },
            'grasland': {
                'color': (124, 186, 96),
                'height_range': (0.30, 0.50),  # ENGERE RANGE = WENIGER GRASLAND
                'name': 'Grasland'
            },
            'wald': {
                'color': (34, 139, 34),
                'height_range': (0.45, 0.65),  # ENGERE RANGE
                'name': 'Wald'
            },
            'gebirge': {
                'color': (139, 137, 137),
                'height_range': (0.60, 0.85),  # VON 0.9 AUF 0.85 = MEHR BERGE
                'name': 'Gebirge'
            },
            'schnee': {
                'color': (255, 255, 255),
                'height_range': (0.80, 1.0),   # VERSCHOBEN für mehr Schnee
                'name': 'Schnee'
            }
        }
    
    def generate_terrain(self, scale=100.0, octaves=6, persistence=0.5, 
                         lacunarity=2.0, seed=42, base_scale=1.0):
        """
        Generiert das Terrain mit Perlin Noise
        
        Args:
            scale: Skalierung des Terrains (je kleiner, desto größer die Biome)
            octaves: Anzahl der Oktaven für das Noise
            persistence: Persistenz für die Oktaven
            lacunarity: Lacunarity für die Oktaven
            seed: Seed für reproduzierbare Ergebnisse
            base_scale: Grundskalierung für die Höhenverteilung
        """
        terrain = np.zeros((self.height, self.width))
        
        # Noise mit mehreren Skalen für natürlichere Übergänge
        for y in range(self.height):
            for x in range(self.width):
                # Normalisierte Koordinaten
                nx = x / self.width * scale
                ny = y / self.height * scale
                
                # Haupt-Noise
                value = noise.pnoise3(
                    nx, ny, 0.5,
                    octaves=octaves,
                    persistence=persistence,
                    lacunarity=lacunarity,
                    repeatx=1024,
                    repeaty=1024,
                    base=seed
                )
                
                # Zweites Noise für mehr Variabilität (optional)
                if base_scale > 0:
                    value2 = noise.pnoise3(
                        nx * 0.5, ny * 0.5, 0.3,
                        octaves=3,
                        persistence=0.3,
                        lacunarity=1.5,
                        repeatx=1024,
                        repeaty=1024,
                        base=seed + 100
                    )
                    value = value * 0.7 + value2 * 0.3
                
                terrain[y, x] = value
        
        # Auf [0, 1] normalisieren
        self.terrain = (terrain - terrain.min()) / (terrain.max() - terrain.min())
        
        # Kontrast anpassen für klarere Biome
        self._adjust_contrast()
    
    def _adjust_contrast(self, contrast=1.2):
        """Passt den Kontrast an, um Biome deutlicher zu trennen"""
        if self.terrain is None:
            return
        
        # Mittelwert
        mean = np.mean(self.terrain)
        
        # Kontrast anpassen
        self.terrain = mean + (self.terrain - mean) * contrast
        
        # Auf [0, 1] begrenzen
        self.terrain = np.clip(self.terrain, 0, 1)
        
        # Neu normalisieren für bessere Verteilung
        self.terrain = (self.terrain - self.terrain.min()) / (self.terrain.max() - self.terrain.min())
    
    def assign_biomes_with_smoothing(self, smoothness=3):
        """
        Weist Biome zu mit Glättung für zusammenhängendere Gebiete
        
        Args:
            smoothness: Grad der Glättung (höher = mehr zusammenhängend)
        """
        if self.terrain is None:
            raise ValueError("Terrain wurde noch nicht generiert.")
        
        # Zuerst rohe Biome zuweisen
        raw_biomes = np.zeros((self.height, self.width), dtype=int)
        biome_list = list(self.biomes.keys())
        
        for y in range(self.height):
            for x in range(self.width):
                height = self.terrain[y, x]
                raw_biomes[y, x] = self._get_biome_index(height, biome_list)
        
        # Biome glätten für zusammenhängendere Gebiete
        smoothed_biomes = self._smooth_biomes(raw_biomes, smoothness)
        
        # Farben zuweisen
        self.biome_map = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        for y in range(self.height):
            for x in range(self.width):
                biome_idx = smoothed_biomes[y, x]
                biome_name = biome_list[biome_idx]
                self.biome_map[y, x] = self.biomes[biome_name]['color']
    
    def _get_biome_index(self, height, biome_list):
        """Bestimmt den Index des Bioms basierend auf der Höhe"""
        # Spezielle Behandlung für Wasser
        if height < 0.15:
            return biome_list.index('wasser')
        
        # Für andere Biome den passenden Bereich finden
        for i, biome_name in enumerate(biome_list):
            if biome_name == 'wasser':
                continue
            
            min_h, max_h = self.biomes[biome_name]['height_range']
            if min_h <= height <= max_h:
                return i
        
        # Fallback: Grasland
        return biome_list.index('grasland')
    
    def _smooth_biomes(self, biomes, smoothness):
        """
        Glättet die Biome für zusammenhängendere Gebiete
        
        Args:
            biomes: 2D-Array mit Biom-Indizes
            smoothness: Grad der Glättung
        """
        if smoothness <= 0:
            return biomes
        
        smoothed = biomes.copy()
        
        for _ in range(smoothness):
            new_smoothed = smoothed.copy()
            for y in range(1, self.height - 1):
                for x in range(1, self.width - 1):
                    # Nachbarn zählen
                    neighbors = [
                        smoothed[y-1, x], smoothed[y+1, x],
                        smoothed[y, x-1], smoothed[y, x+1],
                        smoothed[y-1, x-1], smoothed[y-1, x+1],
                        smoothed[y+1, x-1], smoothed[y+1, x+1]
                    ]
                    
                    # Häufigstes Biom in der Nachbarschaft finden
                    unique, counts = np.unique(neighbors, return_counts=True)
                    most_common = unique[np.argmax(counts)]
                    
                    # Wenn das aktuelle Biom nicht das häufigste ist, ersetzen
                    if smoothed[y, x] != most_common and counts.max() >= 5:
                        new_smoothed[y, x] = most_common
            
            smoothed = new_smoothed
        
        return smoothed
    
    def generate_image(self, output_path="landscape.png"):
        """Generiert das Bild und speichert es"""
        if self.biome_map is None:
            self.assign_biomes_with_smoothing()
        
        # Bild erstellen und speichern
        image = Image.fromarray(self.biome_map, 'RGB')
        image.save(output_path)
        
        # Auch als Preview anzeigen
        plt.figure(figsize=(14, 10))
        plt.imshow(self.biome_map)
        plt.title(f'Landscape Generator - {self.width}x{self.height}')
        plt.axis('off')
        
        # Legende hinzufügen
        from matplotlib.patches import Patch
        legend_elements = [
            Patch(facecolor=np.array(self.biomes[name]['color'])/255, 
                  label=self.biomes[name]['name'])
            for name in self.biomes
        ]
        plt.legend(handles=legend_elements, loc='upper right', 
                  bbox_to_anchor=(1.15, 1))
        
        plt.tight_layout()
        plt.savefig(output_path.replace('.png', '_preview.png'), 
                   dpi=300, bbox_inches='tight')
        plt.show()
        
        print(f"Bild erfolgreich generiert: {output_path}")
        print(f"Auflösung: {self.width}x{self.height}")
        print(f"Anzahl verschiedener Biome: {len(self.biomes)}")
    
    def export_heightmap(self, output_path="heightmap.png"):
        """Exportiert die Höhenkarte als Graustufenbild"""
        if self.terrain is None:
            raise ValueError("Terrain wurde noch nicht generiert.")
        
        heightmap = (self.terrain * 255).astype(np.uint8)
        image = Image.fromarray(heightmap, 'L')
        image.save(output_path)
        print(f"Höhenkarte exportiert: {output_path}")

def main():
    """Hauptfunktion mit verschiedenen Einstellungsmöglichkeiten"""
    
    # ===== EINSTELLUNGEN FÜR GRÖSSERE, ZUSAMMENHÄNGENDERE BIOME =====
    
    # Größe des Bildes
    width = 480
    height = 270
    
    print(f"Landscape Generator startet...")
    print(f"Größe: {width}x{height}")
    
    # Generator initialisieren
    generator = LandscapeGenerator(width, height)
    
    # ===== OPTION 1: Große, zusammenhängende Biome =====
    # print("\nGeneriere Terrain mit großen, zusammenhängenden Biomen...")
    # generator.generate_terrain(
    #     scale=80.0,          # KLEINER = GRÖSSERE BIOME (weniger Detail)
    #     octaves=4,           # WENIGER = GRÖSSERE STRUKTUREN
    #     persistence=0.6,     # HÖHER = MEHR KONTRAST
    #     lacunarity=1.8,      # NIEDRIGER = WEICHERE ÜBERGÄNGE
    #     seed=42,             # FESTER SEED FÜR REPRODUZIERBARKEIT
    #     base_scale=0.3       # WENIGER VARIATION = GLATTERE ÜBERGÄNGE
    # )
    
    # ===== OPTION 2: Sehr große Biome mit starker Glättung =====
    generator.generate_terrain(
        scale=4.0,          # SEHR KLEIN = SEHR GROSSE BIOME
        octaves=3,           # SEHR WENIG = GROBE STRUKTUREN
        persistence=0.7,     # HOHER KONTRAST
        lacunarity=1.5,      # WEICHE ÜBERGÄNGE
        seed=42,
        base_scale=0.1       # MINIMALE VARIATION
    )
    
    # ===== OPTION 3: Balance zwischen Größe und Details =====
    # generator.generate_terrain(
    #     scale=120.0,         # MITTEL = BALANCED
    #     octaves=5,           # MITTEL = GUTE DETAILS
    #     persistence=0.5,     # AUSGEWOGEN
    #     lacunarity=2.0,      # STANDARD
    #     seed=42,
    #     base_scale=0.5       # ETWAS VARIATION
    # )
    
    # Biome mit Glättung zuweisen (höherer Wert = mehr zusammenhängend)
    print("Weise Biome zu mit Glättung...")
    generator.assign_biomes_with_smoothing(smoothness=5)  # 3-5 für gute Zusammenhänge
    
    # Bild generieren und exportieren
    print("Exportiere Bilder...")
    generator.generate_image("landscape_large_biomes.png")
    generator.export_heightmap("heightmap_large_biomes.png")
    
    # Statistiken anzeigen
    print("\nStatistik:")
    unique, counts = np.unique(generator.biome_map.reshape(-1, 3), axis=0, return_counts=True)
    total_pixels = width * height
    for i, biome_name in enumerate(generator.biomes):
        # Zähle Pixel für jedes Biom (vereinfacht)
        color = np.array(generator.biomes[biome_name]['color'])
        count = np.sum(np.all(generator.biome_map == color, axis=2))
        percentage = (count / total_pixels) * 100
        print(f"   {generator.biomes[biome_name]['name']}: {percentage:.1f}%")
    
    print("\nFertig!")

if __name__ == "__main__":
    main()