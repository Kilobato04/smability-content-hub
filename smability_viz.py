import matplotlib.pyplot as plt
import pandas as pd
import json

# --- DATA DUMMY EMBEBIDA ---
# Simulamos una comparativa de precisión: SMAA vs Estación de Referencia (SIMAT)
dummy_data_json = '''
{
    "labels": ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"],
    "smaa_precision": [12.5, 18.2, 15.4, 28.9, 32.1, 29.5],
    "simat_ref": [13.0, 17.8, 16.0, 30.2, 33.5, 30.0]
}
'''

def generate_wow_chart():
    data = json.loads(dummy_data_json)
    df = pd.DataFrame(data)
    
    # Estética Smability Navy Industrial
    NAVY_BG = '#001A4D'
    NEON_GREEN = '#39FF14'
    ACCENT_BLUE = '#0047AB'
    TEXT_COLOR = '#FFFFFF'

    fig, ax = plt.subplots(figsize=(10, 8), facecolor=NAVY_BG)
    ax.set_facecolor(NAVY_BG)

    # Dibujar Líneas
    plt.plot(df['labels'], df['simat_ref'], color=TEXT_COLOR, alpha=0.3, 
             linestyle='--', label='Referencia SIMAT ($250k USD)', linewidth=2)
    
    plt.plot(df['labels'], df['smaa_precision'], color=NEON_GREEN, 
             label='Sensor SMAA ($8.4k USD)', linewidth=5, marker='o', markersize=10)

    # Personalización Técnica
    ax.tick_params(colors=TEXT_COLOR, labelsize=10)
    for spine in ax.spines.values():
        spine.set_color('#1A3A6D')

    plt.title("CORRELACIÓN DE PRECISIÓN: SMAA vs REFERENCIA", 
              color=TEXT_COLOR, fontsize=18, fontweight='900', pad=20, loc='left')
    
    plt.legend(facecolor=NAVY_BG, edgecolor=NEON_GREEN, labelcolor=TEXT_COLOR)
    plt.grid(True, alpha=0.05)

    # Sello de Patente e Integridad
    plt.figtext(0.15, 0.02, "ALGORITMO DE CALIBRACIÓN DINÁMICA | PATENTE IMPI 2026", 
                color=NEON_GREEN, fontsize=9, alpha=0.7, fontweight='bold')

    # Guardar en assets para que el Hub lo vea
    plt.savefig('assets/wow_chart.png', dpi=150, bbox_inches='tight', facecolor=NAVY_BG)
    print("Gráfica 'WOW' generada en assets/wow_chart.png")

if __name__ == "__main__":
    generate_wow_chart()
