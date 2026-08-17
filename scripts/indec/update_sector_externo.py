from pathlib import Path
from datetime import date
import re

import pandas as pd
import requests


BASE_DIR = Path(__file__).resolve().parents[2]

RAW_DIR = BASE_DIR / "src" / "data" / "raw" / "indec" / "sector_externo"
OUT_FILE = BASE_DIR / "src" / "data" / "sector_externo" / "bienes.csv"

SOURCE_URL = "https://www.indec.gob.ar/ftp/cuadros/economia/cin_IV_2025.xls"
RAW_FILE = RAW_DIR / "cin_IV_2025.xls"

RAW_DIR.mkdir(parents=True, exist_ok=True)
OUT_FILE.parent.mkdir(parents=True, exist_ok=True)


def descargar_fuente() -> None:
    try:
        print(f"Descargando Sector Externo desde: {SOURCE_URL}")
        response = requests.get(
            SOURCE_URL,
            timeout=60,
            proxies={"https": "", "http": ""},
        )
        response.raise_for_status()
        RAW_FILE.write_bytes(response.content)
        print(f"[OK] Fuente descargada: {RAW_FILE}")

    except Exception as err:
        if RAW_FILE.exists():
            print("[WARN] No se pudo descargar la fuente, se usa copia local.")
            print(f"   Motivo: {err}")
        else:
            raise RuntimeError(
                f"No se pudo descargar Sector Externo y no existe archivo local en {RAW_FILE}"
            ) from err


def limpiar_numero(valor):
    if pd.isna(valor):
        return None

    if isinstance(valor, (int, float)):
        return float(valor)

    texto = str(valor).strip()

    if texto in ["", "-", "–", "nan"]:
        return None

    texto = texto.replace(".", "")
    texto = texto.replace(",", ".")

    try:
        return float(texto)
    except Exception:
        return None


def detectar_periodo(valor):
    """
    Detecta valores tipo:
    2025T1*
    2025T2
    2024T4*
    """
    if pd.isna(valor):
        return None, None, None

    texto = str(valor).strip().upper()
    texto = texto.replace("*", "")

    match = re.search(r"(20\d{2})T([1-4])", texto)

    if not match:
        return None, None, None

    anio = int(match.group(1))
    trimestre = int(match.group(2))
    periodo = f"{anio}T{trimestre}"

    return periodo, anio, trimestre


def texto_fila(row) -> str:
    return " ".join(
        str(x).lower().strip()
        for x in row.values
        if pd.notna(x)
    )


def buscar_fila(df: pd.DataFrame, patron: str) -> int:
    patron = patron.lower()

    for idx, row in df.iterrows():
        txt = texto_fila(row)
        if patron in txt:
            return idx

    raise RuntimeError(f"No se encontró la fila: {patron}")


def buscar_columnas_periodo(df: pd.DataFrame) -> list:
    """
    Busca en las primeras filas las columnas que tienen encabezados tipo 2025T1*.
    Devuelve:
    [
      {"col": 10, "periodo": "2025T1", "anio": 2025, "trimestre": 1},
      ...
    ]
    """
    columnas = []

    max_filas_header = min(15, len(df))

    for col in df.columns:
        for fila in range(max_filas_header):
            periodo, anio, trimestre = detectar_periodo(df.iloc[fila, col])

            if periodo is not None:
                columnas.append(
                    {
                        "col": col,
                        "periodo": periodo,
                        "anio": anio,
                        "trimestre": trimestre,
                    }
                )
                break

    if not columnas:
        print("DEBUG primeras 15 filas:")
        print(df.head(15).to_string())
        raise RuntimeError("No se detectaron columnas trimestrales.")

    return columnas


def normalizar_bienes_desde_xls(file_path: Path) -> pd.DataFrame:
    print("Leyendo Cuadro 3 - Bienes...")

    df = pd.read_excel(
        file_path,
        sheet_name="Cuadro 3",
        header=None,
    )

    columnas_periodo = buscar_columnas_periodo(df)

    print("Columnas trimestrales detectadas:")
    for c in columnas_periodo:
        print(f"- Columna {c['col']}: {c['periodo']}")

    fila_saldo = buscar_fila(df, "saldo del comercio de bienes")
    fila_exportaciones = buscar_fila(df, "ingresos (exportaciones)")
    fila_importaciones = buscar_fila(df, "egresos (importaciones)")

    print(f"Fila saldo: {fila_saldo}")
    print(f"Fila exportaciones: {fila_exportaciones}")
    print(f"Fila importaciones: {fila_importaciones}")

    registros = []

    for item in columnas_periodo:
        col = item["col"]

        exportaciones = limpiar_numero(df.iloc[fila_exportaciones, col])
        importaciones = limpiar_numero(df.iloc[fila_importaciones, col])
        saldo = limpiar_numero(df.iloc[fila_saldo, col])

        if exportaciones is None or importaciones is None or saldo is None:
            continue

        registros.append(
            {
                "periodo": item["periodo"],
                "anio": item["anio"],
                "trimestre": item["trimestre"],
                "exportaciones": exportaciones,
                "importaciones": importaciones,
                "saldo": saldo,
                "fuente": "INDEC_BDP_C03",
                "fecha_carga": date.today().isoformat(),
            }
        )

    if not registros:
        raise RuntimeError("No se generaron registros válidos.")

    out = pd.DataFrame(registros)
    out = out.sort_values(["anio", "trimestre"]).reset_index(drop=True)

    return out


def merge_incremental(new_data: pd.DataFrame, output_path: Path) -> pd.DataFrame:
    if output_path.exists():
        old_data = pd.read_csv(output_path)
        merged = pd.concat([old_data, new_data], ignore_index=True)
        merged = merged.drop_duplicates(subset=["periodo"], keep="last")
    else:
        old_data = pd.DataFrame(columns=new_data.columns)
        merged = new_data.copy()

    merged = merged.sort_values(["anio", "trimestre"]).reset_index(drop=True)

    print("Resumen incremental Sector Externo - Bienes:")
    print(f"- Filas previas: {len(old_data)}")
    print(f"- Filas fuente actual: {len(new_data)}")
    print(f"- Filas finales: {len(merged)}")

    if len(merged):
        print(f"- Último período: {merged['periodo'].iloc[-1]}")

    return merged


def main() -> None:
    descargar_fuente()

    df_new = normalizar_bienes_desde_xls(RAW_FILE)
    df_final = merge_incremental(df_new, OUT_FILE)

    df_final.to_csv(OUT_FILE, index=False, encoding="utf-8-sig")

    print("[OK] Sector Externo - Bienes actualizado:")
    print(OUT_FILE)
    print("Últimos datos:")
    print(df_final.tail())


if __name__ == "__main__":
    main()