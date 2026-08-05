"""
Auto Converter für GLB zu JSON

Verwendung:
    python auto_converter.py <inFolderPath> <outFolderPath>

Beispiel:
    python auto_converter.py ./models ./output
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

def convert_glb_to_json(converter_script, input_path, output_path):
    """
    Ruft Converter.py auf, um eine einzelne GLB-Datei zu konvertieren.
    
    Args:
        converter_script (str): Pfad zu Converter.py
        input_path (str): Pfad zur GLB-Datei
        output_path (str): Pfad zur Ausgabe-JSON-Datei
    
    Returns:
        bool: True wenn erfolgreich, sonst False
    """
    try:
        # Stelle sicher, dass das Ausgabeverzeichnis existiert
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Converter.py aufrufen
        cmd = [
            'python',
            converter_script,
            input_path,
            output_path
        ]
        
        print(f"  Konvertiere: {os.path.basename(input_path)} -> {os.path.basename(output_path)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode == 0:
            print(f"    ✓ Erfolgreich")
            if result.stdout:
                print(f"    {result.stdout.strip()}")
            return True
        else:
            print(f"    ✗ Fehler (Code {result.returncode})")
            if result.stderr:
                print(f"    Fehler: {result.stderr.strip()}")
            return False
            
    except Exception as e:
        print(f"    ✗ Ausnahme: {str(e)}")
        return False

def find_converter_script():
    """
    Findet Converter.py im selben Verzeichnis wie dieses Skript.
    
    Returns:
        str: Pfad zu Converter.py oder None wenn nicht gefunden
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    converter_path = os.path.join(script_dir, 'Converter.py')
    
    if os.path.isfile(converter_path):
        return converter_path
    
    # Fallback: Im aktuellen Arbeitsverzeichnis suchen
    cwd_converter = os.path.join(os.getcwd(), 'Converter.py')
    if os.path.isfile(cwd_converter):
        return cwd_converter
    
    return None

def main():
    parser = argparse.ArgumentParser(
        description='Konvertiert alle GLB-Dateien in einem Ordner zu JSON.',
        epilog='Beispiel: python auto_converter.py ./models ./output'
    )
    parser.add_argument(
        'inFolderPath',
        help='Pfad zum Ordner mit den GLB-Dateien'
    )
    parser.add_argument(
        'outFolderPath',
        help='Pfad zum Ausgabeordner für die JSON-Dateien'
    )
    parser.add_argument(
        '--recursive',
        action='store_true',
        help='Unterordner rekursiv durchsuchen'
    )
    parser.add_argument(
        '--pattern',
        default='*.glb',
        help='Dateimuster für GLB-Dateien (Standard: *.glb)'
    )
    
    args = parser.parse_args()
    
    # Converter.py finden
    converter_script = find_converter_script()
    if not converter_script:
        print("Fehler: Converter.py nicht gefunden!")
        print("Stelle sicher, dass Converter.py im selben Verzeichnis wie dieses Skript liegt.")
        sys.exit(1)
    
    # Eingabe- und Ausgabeordner
    in_folder = Path(args.inFolderPath)
    out_folder = Path(args.outFolderPath)
    
    if not in_folder.exists():
        print(f"Fehler: Eingabeordner '{in_folder}' existiert nicht!")
        sys.exit(1)
    
    if not in_folder.is_dir():
        print(f"Fehler: '{in_folder}' ist kein Ordner!")
        sys.exit(1)
    
    # Alle GLB-Dateien finden
    if args.recursive:
        glb_files = list(in_folder.rglob(args.pattern))
    else:
        glb_files = list(in_folder.glob(args.pattern))
    
    if not glb_files:
        print(f"Keine GLB-Dateien gefunden in '{in_folder}' mit Muster '{args.pattern}'")
        sys.exit(0)
    
    print(f"Gefundene GLB-Dateien: {len(glb_files)}")
    print(f"Converter: {converter_script}")
    print(f"Ausgabeordner: {out_folder}")
    print("-" * 50)
    
    # Konvertierung durchführen
    success_count = 0
    fail_count = 0
    
    for glb_path in glb_files:
        # Relativen Pfad beibehalten (wenn rekursiv)
        if args.recursive:
            rel_path = glb_path.relative_to(in_folder)
            # .glb durch .json ersetzen
            json_path = out_folder / rel_path.with_suffix('.json')
        else:
            json_path = out_folder / glb_path.with_suffix('.json').name
        
        # Konvertieren
        if convert_glb_to_json(converter_script, str(glb_path), str(json_path)):
            success_count += 1
        else:
            fail_count += 1
    
    print("-" * 50)
    print(f"Fertig: {success_count} erfolgreich, {fail_count} fehlgeschlagen")
    
    if fail_count > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()