"""
update_ipim.py
Descarga el Excel del IPI Manufacturero (IPIM) desde INDEC y genera:
  - backend/src/data/ipim.csv          (serie original, desestacionalizada y tendencia)
  - backend/src/data/ipim_full_limpio.csv  (rubros por mes, formato ancho)

Uso:
  python scripts/indec/update_ipim.py
"""

import csv
import re
import subprocess
from io import BytesIO
from pathlib import Path

import pandas as pd

BACKEND_ROOT = Path(__file__).resolve().parents[2]
IPIM_DATA_DIR = BACKEND_ROOT / "src" / "data" / "ipim"

SOURCE_URL = "https://www.indec.gob.ar/ftp/cuadros/economia/sh_ipi_manufacturero_2026.xls"

MESES_MAP = {
    "Enero": 1, "Febrero": 2, "Marzo": 3, "Abril": 4,
    "Mayo": 5, "Junio": 6, "Julio": 7, "Agosto": 8,
    "Septiembre": 9, "Octubre": 10, "Noviembre": 11, "Diciembre": 12,
}

OUTPUT_FILES = {
    "ipim": [IPIM_DATA_DIR / "ipim.csv"],
    "full": [IPIM_DATA_DIR / "ipim_full_limpio.csv"],
}


def descargar(url: str):
    import requests
    try:
        r = requests.get(url, timeout=90)
        r.raise_for_status()
        return r.content
    except Exception:
        result = subprocess.run(
            ["curl.exe", "--silent", "--show-error", "--location", "--fail", url],
            capture_output=True,
            check=True,
        )
        return result.stdout


def normalizar_fecha(anio, mes_str):
    try:
        anio_int = int(float(str(anio)))
    except (ValueError, TypeError):
        return None
    mes_num = MESES_MAP.get(str(mes_str).strip())
    if not mes_num:
        return None
    return f"{anio_int}-{mes_num:02d}"


def calcular_variaciones(rows, columns):
    """
    Calcula variaciones MoM (mes a mes), YoY (año a año) y acumulada YTD para las columnas especificadas.
    Agrega columnas _mom, _yoy y _ytd_yoy para cada columna.
    """
    for i in range(len(rows)):
        current = rows[i]
        
        # MoM: comparar con mes anterior
        if i > 0:
            prev = rows[i - 1]
            for col in columns:
                if col in current and col in prev:
                    curr_val = current[col]
                    prev_val = prev[col]
                    if curr_val is not None and prev_val is not None and prev_val != 0:
                        mom = ((curr_val - prev_val) / prev_val) * 100
                        current[f"{col}_mom"] = round(mom, 2)
                    else:
                        current[f"{col}_mom"] = None
        else:
            for col in columns:
                current[f"{col}_mom"] = None
        
        # YoY: comparar con mes hace 12 meses
        if i >= 12:
            prev_year = rows[i - 12]
            for col in columns:
                if col in current and col in prev_year:
                    curr_val = current[col]
                    prev_val = prev_year[col]
                    if curr_val is not None and prev_val is not None and prev_val != 0:
                        yoy = ((curr_val - prev_val) / prev_val) * 100
                        current[f"{col}_yoy"] = round(yoy, 2)
                    else:
                        current[f"{col}_yoy"] = None
        else:
            for col in columns:
                current[f"{col}_yoy"] = None
        
        # YTD (acumulada del año): comparar acumulado YTD actual vs acumulado YTD año anterior
        current_fecha = current.get("fecha", "")
        current_year = int(current_fecha.split("-")[0]) if "-" in current_fecha else None
        current_month = int(current_fecha.split("-")[1]) if "-" in current_fecha else None
        
        if current_year and current_month:
            # Calcular acumulado desde enero (mes 1) hasta el mes actual del año actual
            ytd_actual = 0
            ytd_anterior = 0
            
            for j in range(i + 1):
                row_j = rows[j]
                fecha_j = row_j.get("fecha", "")
                year_j = int(fecha_j.split("-")[0]) if "-" in fecha_j else None
                month_j = int(fecha_j.split("-")[1]) if "-" in fecha_j else None
                
                # Si es del año actual y mes <= current_month
                if year_j == current_year and month_j and month_j <= current_month:
                    for col in columns:
                        if col in row_j and row_j[col] is not None:
                            ytd_actual += row_j[col]
                
                # Si es del año anterior y mes <= current_month
                if year_j == current_year - 1 and month_j and month_j <= current_month:
                    for col in columns:
                        if col in row_j and row_j[col] is not None:
                            ytd_anterior += row_j[col]
            
            # Calcular variación YTD
            for col in columns:
                if ytd_actual > 0 and ytd_anterior > 0 and ytd_anterior != 0:
                    ytd_yoy = ((ytd_actual - ytd_anterior) / ytd_anterior) * 100
                    current[f"{col}_ytd_yoy"] = round(ytd_yoy, 2)
                else:
                    current[f"{col}_ytd_yoy"] = None
        else:
            for col in columns:
                current[f"{col}_ytd_yoy"] = None
    
    return rows


def parsear_cuadro1(xls: pd.ExcelFile):
    """
    Cuadro 1: serie original, desestacionalizada y tendencia-ciclo.
    Col 1=año, 2=mes, 3=serie_original, 7=desestacionalizada, 10=tendencia
    Datos desde fila 8 (0-indexed).
    """
    df = pd.read_excel(xls, sheet_name="Cuadro 1", header=None)

    rows = []
    anio_actual = None

    for i in range(8, len(df)):
        fila = df.iloc[i]

        anio_raw = fila.iloc[1]
        if pd.notna(anio_raw):
            try:
                anio_int = int(float(re.sub(r"[^0-9]", "", str(anio_raw))))
                if 2000 <= anio_int <= 2100:
                    anio_actual = anio_int
            except (ValueError, TypeError):
                pass

        mes_raw = fila.iloc[2]
        if pd.isna(mes_raw) or str(mes_raw).strip() not in MESES_MAP:
            continue
        if anio_actual is None:
            continue

        fecha = normalizar_fecha(anio_actual, mes_raw)
        if not fecha:
            continue

        def safe_float(v):
            try:
                f = float(v)
                return None if pd.isna(f) else f
            except (TypeError, ValueError):
                return None

        rows.append({
            "fecha": fecha,
            "serie_original": safe_float(fila.iloc[3]),
            "serie_desestacionalizada": safe_float(fila.iloc[7]),
            "serie_tendencia_ciclo": safe_float(fila.iloc[10]),
        })

    return rows


def parsear_cuadro2(xls: pd.ExcelFile):
    """
    Cuadro 2: rubros, serie original.
    Fila 2 = códigos, fila 3 = nombres de columnas.
    Col 1=año, 2=mes, 3..N = rubros.
    Datos desde fila 6 (0-indexed).
    """
    df = pd.read_excel(xls, sheet_name="Cuadro 2", header=None)

    # Nombres de columnas en fila 3 (0-indexed), desde col 3 en adelante
    col_names = df.iloc[3, 3:].tolist()
    col_names = [str(c).strip() if pd.notna(c) else f"col_{i}" for i, c in enumerate(col_names)]

    rows = []
    anio_actual = None

    for i in range(6, len(df)):
        fila = df.iloc[i]

        anio_raw = fila.iloc[1]
        if pd.notna(anio_raw):
            try:
                anio_int = int(float(re.sub(r"[^0-9]", "", str(anio_raw))))
                if 2000 <= anio_int <= 2100:
                    anio_actual = anio_int
            except (ValueError, TypeError):
                pass

        mes_raw = fila.iloc[2]
        if pd.isna(mes_raw) or str(mes_raw).strip() not in MESES_MAP:
            continue
        if anio_actual is None:
            continue

        fecha = normalizar_fecha(anio_actual, mes_raw)
        if not fecha:
            continue

        mes_num = MESES_MAP[str(mes_raw).strip()]
        row = {
            "fecha": f"{fecha}-01",
            "anio": anio_actual,
            "mes": str(mes_raw).strip(),
        }

        valores = fila.iloc[3:].tolist()
        for j, nombre in enumerate(col_names):
            if j < len(valores):
                v = valores[j]
                if pd.isna(v) or str(v).strip() in ("///", "-", "s", ""):
                    row[nombre] = "///"
                else:
                    try:
                        row[nombre] = float(v)
                    except (TypeError, ValueError):
                        row[nombre] = "///"
            else:
                row[nombre] = "///"

        rows.append(row)

    return rows


def guardar_csv(rows, paths, fieldnames):
    for path in paths:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
        print(f"  -> {path} ({len(rows)} filas)")


def main():
    print("=== Actualizacion IPIM (IPI Manufacturero) ===")
    print(f"URL: {SOURCE_URL}\n")

    content = descargar(SOURCE_URL)
    print(f"Archivo descargado ({len(content):,} bytes)")

    xls = pd.ExcelFile(BytesIO(content))
    print(f"Hojas disponibles: {xls.sheet_names}\n")

    # --- ipim.csv ---
    print("Parseando Cuadro 1 (serie original / desestacionalizada / tendencia)...")
    rows_c1 = parsear_cuadro1(xls)
    rows_c1 = [r for r in rows_c1 if r["serie_original"] is not None]
    
    # Calcular variaciones MoM y YoY
    print("  Calculando variaciones MoM y YoY...")
    rows_c1 = calcular_variaciones(rows_c1, ["serie_original", "serie_desestacionalizada", "serie_tendencia_ciclo"])
    
    print(f"  {len(rows_c1)} filas")
    fieldnames_c1 = ["fecha", 
                     "serie_original", "serie_original_mom", "serie_original_yoy", "serie_original_ytd_yoy",
                     "serie_desestacionalizada", "serie_desestacionalizada_mom", "serie_desestacionalizada_yoy", "serie_desestacionalizada_ytd_yoy",
                     "serie_tendencia_ciclo", "serie_tendencia_ciclo_mom", "serie_tendencia_ciclo_yoy", "serie_tendencia_ciclo_ytd_yoy"]
    guardar_csv(rows_c1, OUTPUT_FILES["ipim"], fieldnames_c1)

    # --- ipim_full_limpio.csv ---
    print("\nParseando Cuadro 2 (rubros)...")
    rows_c2 = parsear_cuadro2(xls)
    print(f"  {len(rows_c2)} filas")

    if rows_c2:
        # Reconstruir fieldnames desde el primer row
        fieldnames_full = list(rows_c2[0].keys())
        guardar_csv(rows_c2, OUTPUT_FILES["full"], fieldnames_full)

    print("\nOK: IPIM actualizado.")
    if rows_c1:
        ultimo = rows_c1[-1]
        print(f"   Ultimo periodo: {ultimo['fecha']} | original={ultimo['serie_original']:.2f} | mom={ultimo['serie_original_mom']}%")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"\nError: {err}")
        raise SystemExit(1) from err
