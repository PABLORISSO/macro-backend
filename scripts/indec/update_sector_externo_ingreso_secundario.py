from pathlib import Path
from datetime import date
import re

import pandas as pd
import requests


BASE_DIR = Path(__file__).resolve().parents[2]

RAW_DIR = BASE_DIR / "src" / "data" / "raw" / "indec" / "sector_externo"
OUT_FILE = BASE_DIR / "src" / "data" / "sector_externo" / "ingreso_secundario.csv"

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
        raise RuntimeError("No se detectaron columnas trimestrales.")

    return columnas


def buscar_fila_por_claves(df: pd.DataFrame, claves: list) -> int:
    claves = [c.lower() for c in claves]

    for idx, row in df.iterrows():
        txt = texto_fila(row)
        if all(clave in txt for clave in claves):
            return idx

    raise RuntimeError(f"No se encontró fila con claves: {claves}")


def buscar_credito_debito_despues(df: pd.DataFrame, fila_inicio: int):
    fila_credito = None
    fila_debito = None

    for idx in range(fila_inicio + 1, len(df)):
        txt = texto_fila(df.iloc[idx])

        if fila_credito is None and txt.startswith("crédito"):
            fila_credito = idx

        if fila_debito is None and txt.startswith("débito"):
            fila_debito = idx

        if fila_credito is not None and fila_debito is not None:
            return fila_credito, fila_debito

    raise RuntimeError("No se encontraron filas Crédito/Débito después de Ingreso secundario.")


def normalizar_ingreso_secundario_desde_xls(file_path: Path) -> pd.DataFrame:
    print("Leyendo Cuadro 1 - Ingreso secundario...")

    df = pd.read_excel(
        file_path,
        sheet_name="Cuadro 1",
        header=None,
    )

    columnas_periodo = buscar_columnas_periodo(df)

    fila_saldo = buscar_fila_por_claves(df, ["1.c", "ingreso secundario"])
    fila_ingresos, fila_egresos = buscar_credito_debito_despues(df, fila_saldo)

    print(f"Fila saldo: {fila_saldo}")
    print(f"Fila ingresos/crédito: {fila_ingresos}")
    print(f"Fila egresos/débito: {fila_egresos}")

    registros = []

    for item in columnas_periodo:
        col = item["col"]

        ingresos = limpiar_numero(df.iloc[fila_ingresos, col])
        egresos = limpiar_numero(df.iloc[fila_egresos, col])
        saldo = limpiar_numero(df.iloc[fila_saldo, col])

        if ingresos is None or egresos is None or saldo is None:
            continue

        registros.append(
            {
                "periodo": item["periodo"],
                "anio": item["anio"],
                "trimestre": item["trimestre"],
                "ingresos": ingresos,
                "egresos": egresos,
                "saldo": saldo,
                "fuente": "INDEC_BDP_C01_ING_SEC",
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

    print("Resumen incremental Sector Externo - Ingreso secundario:")
    print(f"- Filas previas: {len(old_data)}")
    print(f"- Filas fuente actual: {len(new_data)}")
    print(f"- Filas finales: {len(merged)}")

    if len(merged):
        print(f"- Último período: {merged['periodo'].iloc[-1]}")

    return merged


def main() -> None:
    descargar_fuente()

    df_new = normalizar_ingreso_secundario_desde_xls(RAW_FILE)
    df_final = merge_incremental(df_new, OUT_FILE)

    df_final.to_csv(OUT_FILE, index=False, encoding="utf-8-sig")

    print("[OK] Sector Externo - Ingreso secundario actualizado:")
    print(OUT_FILE)
    print("Últimos datos:")
    print(df_final.tail())


if __name__ == "__main__":
    main()