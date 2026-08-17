from pathlib import Path

import pandas as pd
import requests

BASE_DIR = Path(__file__).resolve().parents[2]

RAW_DIR = BASE_DIR / "src" / "data" / "raw" / "indec" / "emae"
RAW_FILE = RAW_DIR / "sh_emae_mensual_base2004.xls"
OUT_FILE = BASE_DIR / "src" / "data" / "actividad" / "emae.csv"

SOURCE_URL = "https://www.indec.gob.ar/ftp/cuadros/economia/sh_emae_mensual_base2004.xls"

OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
RAW_DIR.mkdir(parents=True, exist_ok=True)


def descargar_fuente() -> None:
    try:
        print(f"Descargando EMAE desde: {SOURCE_URL}")
        response = requests.get(SOURCE_URL, timeout=45, proxies={'https': '', 'http': ''})
        response.raise_for_status()
        RAW_FILE.write_bytes(response.content)
        print(f"[OK] Fuente descargada: {RAW_FILE}")
    except Exception as err:
        if RAW_FILE.exists():
            print("[WARN] No se pudo descargar la fuente, se usa copia local.")
            print(f"   Motivo: {err}")
        else:
            raise RuntimeError(
                f"No se pudo descargar EMAE y no existe archivo local en {RAW_FILE}"
            ) from err


def normalizar_emae_desde_xls(file_path: Path) -> pd.DataFrame:
    print("Leyendo archivo EMAE...")
    df = pd.read_excel(file_path, skiprows=3)

    df.columns = [
        "anio",
        "mes",
        "emae",
        "var_interanual",
        "desestacionalizado",
        "var_mensual",
        "tendencia",
        "var_tendencia",
    ]

    df = df.dropna(subset=["mes"])
    df["anio"] = df["anio"].ffill()

    meses = {
        "Enero": "01",
        "Febrero": "02",
        "Marzo": "03",
        "Abril": "04",
        "Mayo": "05",
        "Junio": "06",
        "Julio": "07",
        "Agosto": "08",
        "Septiembre": "09",
        "Octubre": "10",
        "Noviembre": "11",
        "Diciembre": "12",
    }

    df["mes_num"] = df["mes"].map(meses)
    df = df[df["mes_num"].notna()]
    df["fecha"] = df["anio"].astype(int).astype(str) + "-" + df["mes_num"] + "-01"

    out = df[
        [
            "fecha",
            "emae",
            "var_interanual",
            "desestacionalizado",
            "var_mensual",
            "tendencia",
            "var_tendencia",
        ]
    ].copy()

    for col in [
        "emae",
        "var_interanual",
        "desestacionalizado",
        "var_mensual",
        "tendencia",
        "var_tendencia",
    ]:
        out[col] = pd.to_numeric(out[col], errors="coerce")

    out = out.dropna(subset=["emae", "desestacionalizado", "tendencia"])
    out = out.sort_values("fecha")
    return out


def merge_incremental(new_data: pd.DataFrame, output_path: Path) -> pd.DataFrame:
    if output_path.exists():
        old_data = pd.read_csv(output_path)
        merged = pd.concat([old_data, new_data], ignore_index=True)
        merged = merged.drop_duplicates(subset=["fecha"], keep="last")
    else:
        old_data = pd.DataFrame(columns=new_data.columns)
        merged = new_data.copy()

    merged = merged.sort_values("fecha").reset_index(drop=True)

    filas_previas = len(old_data)
    filas_nuevas_fuente = len(new_data)
    filas_finales = len(merged)
    agregadas_netas = max(filas_finales - filas_previas, 0)

    print("Resumen incremental EMAE:")
    print(f"- Filas previas: {filas_previas}")
    print(f"- Filas fuente actual: {filas_nuevas_fuente}")
    print(f"- Filas finales: {filas_finales}")
    print(f"- Nuevas netas agregadas: {agregadas_netas}")
    if filas_finales:
        print(f"- Última fecha: {merged['fecha'].iloc[-1]}")

    return merged


def main() -> None:
    descargar_fuente()
    df_new = normalizar_emae_desde_xls(RAW_FILE)
    df_final = merge_incremental(df_new, OUT_FILE)
    df_final.to_csv(OUT_FILE, index=False, encoding="utf-8-sig")

    print("[OK] EMAE actualizado:")
    print(OUT_FILE)
    print("Ultimos datos:")
    print(df_final.tail())


if __name__ == "__main__":
    main()