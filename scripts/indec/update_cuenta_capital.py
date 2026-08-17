from pathlib import Path
from datetime import date
import re

import pandas as pd
import requests


BASE_DIR = Path(__file__).resolve().parents[2]

RAW_DIR = BASE_DIR / "src" / "data" / "raw" / "indec" / "sector_externo"
DATA_DIR = BASE_DIR / "src" / "data" / "sector_externo"

SOURCE_URL = "https://www.indec.gob.ar/ftp/cuadros/economia/cin_IV_2025.xls"
RAW_FILE = RAW_DIR / "cin_IV_2025.xls"

OUT_FILE = DATA_DIR / "cuenta_capital.csv"

RAW_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)


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
    if pd.isna(valor):
        return None, None, None

    texto = str(valor).strip().upper().replace("*", "")
    match = re.search(r"(20\d{2})T([1-4])", texto)

    if not match:
        return None, None, None

    anio = int(match.group(1))
    trimestre = int(match.group(2))

    return f"{anio}T{trimestre}", anio, trimestre


def texto_fila(row) -> str:
    return " ".join(
        str(x).lower().strip()
        for x in row.values
        if pd.notna(x)
    )


def buscar_columnas_periodo(df: pd.DataFrame) -> list:
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


def buscar_fila_por_inicio(df: pd.DataFrame, inicio: str) -> int:
    inicio = inicio.lower()

    for idx, row in df.iterrows():
        txt = texto_fila(row)
        if txt.startswith(inicio):
            return idx

    print("DEBUG filas candidatas:")
    for idx, row in df.iterrows():
        txt = texto_fila(row)
        if "cuenta capital" in txt or "capital" in txt:
            print(idx, "=>", txt)

    raise RuntimeError(f"No se encontró fila que empiece con: {inicio}")


def normalizar_cuenta_capital_desde_xls(file_path: Path) -> pd.DataFrame:
    print("Leyendo Cuadro 1 - Cuenta capital...")

    df = pd.read_excel(
        file_path,
        sheet_name="Cuadro 1",
        header=None,
    )

    columnas_periodo = buscar_columnas_periodo(df)

    # En Cuadro 1 debería aparecer como "2. Cuenta capital"
    fila_cuenta_capital = buscar_fila_por_inicio(df, "2. cuenta de capital")
   
    print(f"Fila cuenta capital: {fila_cuenta_capital}")

    registros = []

    for item in columnas_periodo:
        col = item["col"]

        cuenta_capital = limpiar_numero(df.iloc[fila_cuenta_capital, col])

        if cuenta_capital is None:
            continue

        registros.append(
            {
                "periodo": item["periodo"],
                "anio": item["anio"],
                "trimestre": item["trimestre"],
                "cuenta_capital": cuenta_capital,
                "fuente": "INDEC_BDP_C01_CUENTA_CAPITAL",
                "fecha_carga": date.today().isoformat(),
            }
        )

    if not registros:
        raise RuntimeError("No se generaron registros válidos.")

    out = pd.DataFrame(registros)
    out = out.sort_values(["anio", "trimestre"]).reset_index(drop=True)

    return out


def main() -> None:
    descargar_fuente()

    df = normalizar_cuenta_capital_desde_xls(RAW_FILE)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_FILE, index=False, encoding="utf-8-sig")

    print("[OK] Cuenta capital actualizada:")
    print(OUT_FILE)
    print("Últimos datos:")
    print(df.tail())


if __name__ == "__main__":
    main()