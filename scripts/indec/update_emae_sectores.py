from pathlib import Path

import pandas as pd
import requests

BASE_DIR = Path(__file__).resolve().parents[2]

RAW_DIR = BASE_DIR / "src" / "data" / "raw" / "indec" / "emae"
RAW_FILE = RAW_DIR / "sh_emae_actividad_base2004.xls"
OUT_FILE = BASE_DIR / "src" / "data" / "actividad" / "emae_sectores.csv"

SOURCE_URL = "https://www.indec.gob.ar/ftp/cuadros/economia/sh_emae_actividad_base2004.xls"

OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
RAW_DIR.mkdir(parents=True, exist_ok=True)


def descargar_fuente() -> None:
    try:
        print(f"Descargando EMAE sectores desde: {SOURCE_URL}")
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
                f"No se pudo descargar EMAE sectores y no existe archivo local en {RAW_FILE}"
            ) from err


def parse_sheet(sheet_name: str) -> pd.DataFrame:
    """
    Lee una hoja del XLS.
    Estructura: fila 2 = encabezados (col0=año, col1=mes, col2..N = sectores)
                filas 5+ = datos
    """
    raw = pd.read_excel(RAW_FILE, sheet_name=sheet_name, header=None)

    sectores = raw.iloc[2, 2:].tolist()
    sectores_cortos = []
    for s in sectores:
        if isinstance(s, str) and " - " in s:
            sectores_cortos.append(s.split(" - ", 1)[1].strip())
        else:
            sectores_cortos.append(str(s))

    data = raw.iloc[5:].copy()
    data.columns = ["anio", "mes"] + sectores_cortos + list(
        range(len(data.columns) - 2 - len(sectores_cortos))
    )

    data["anio"] = data["anio"].ffill()
    data = data[data["mes"].notna() & data["mes"].apply(lambda x: isinstance(x, str))]

    meses_map = {
        "Enero": 1,
        "Febrero": 2,
        "Marzo": 3,
        "Abril": 4,
        "Mayo": 5,
        "Junio": 6,
        "Julio": 7,
        "Agosto": 8,
        "Septiembre": 9,
        "Octubre": 10,
        "Noviembre": 11,
        "Diciembre": 12,
    }
    data["mes_num"] = data["mes"].map(meses_map)
    data = data[data["mes_num"].notna()]
    data["fecha"] = pd.to_datetime(
        data["anio"].astype(int).astype(str)
        + "-"
        + data["mes_num"].astype(int).astype(str)
        + "-01"
    ).dt.strftime("%Y-%m-%d")

    df_long = data[["fecha"] + sectores_cortos].melt(
        id_vars="fecha", var_name="sector", value_name="valor"
    )
    df_long = df_long[df_long["valor"].notna()]
    df_long["valor"] = pd.to_numeric(df_long["valor"], errors="coerce")
    df_long = df_long[df_long["valor"].notna()]

    return df_long


def merge_incremental(new_data: pd.DataFrame, output_path: Path) -> pd.DataFrame:
    if output_path.exists():
        old_data = pd.read_csv(output_path)
        merged = pd.concat([old_data, new_data], ignore_index=True)
        merged = merged.drop_duplicates(subset=["fecha", "sector"], keep="last")
    else:
        old_data = pd.DataFrame(columns=new_data.columns)
        merged = new_data.copy()

    merged = merged.sort_values(["fecha", "sector"]).reset_index(drop=True)

    filas_previas = len(old_data)
    filas_nuevas_fuente = len(new_data)
    filas_finales = len(merged)
    agregadas_netas = max(filas_finales - filas_previas, 0)

    print("Resumen incremental EMAE sectores:")
    print(f"- Filas previas: {filas_previas}")
    print(f"- Filas fuente actual: {filas_nuevas_fuente}")
    print(f"- Filas finales: {filas_finales}")
    print(f"- Nuevas netas agregadas: {agregadas_netas}")
    if filas_finales:
        print(f"- Última fecha: {merged['fecha'].iloc[-1]}")

    return merged


def main() -> None:
    descargar_fuente()

    df_indice = parse_sheet("Tabla Letras").rename(columns={"valor": "indice"})
    df_var = parse_sheet("Tabla Var Letras").rename(columns={"valor": "var_interanual"})

    df_new = df_indice.merge(df_var, on=["fecha", "sector"], how="left")
    df_new = df_new.sort_values(["fecha", "sector"])

    df_final = merge_incremental(df_new, OUT_FILE)
    df_final.to_csv(OUT_FILE, index=False, encoding="utf-8-sig")

    print("[OK] EMAE sectores actualizado:")
    print(OUT_FILE)
    print(f"   {len(df_final)} filas, {df_final['sector'].nunique()} sectores")
    if len(df_final):
        ultima_fecha = df_final["fecha"].max()
        print(f"   Ultimo periodo: {str(ultima_fecha)[:7]}")
        print(
            df_final[df_final["fecha"] == ultima_fecha][
                ["sector", "indice", "var_interanual"]
            ].to_string(index=False)
        )


if __name__ == "__main__":
    main()