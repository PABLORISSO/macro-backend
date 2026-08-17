from pathlib import Path
from datetime import date
import json

import pandas as pd
import requests


BASE_DIR = Path(__file__).resolve().parents[2]

RAW_DIR = BASE_DIR / "src" / "data" / "raw" / "worldbank"
DATA_DIR = BASE_DIR / "src" / "data" / "international"

OUT_FILE = DATA_DIR / "worldbank_panel_anual.csv"

RAW_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)


PAISES = {
    "ARG": {"nombre": "Argentina", "region": "LATAM"},
    "BRA": {"nombre": "Brasil", "region": "LATAM"},
    "CHL": {"nombre": "Chile", "region": "LATAM"},
    "URY": {"nombre": "Uruguay", "region": "LATAM"},
    "PRY": {"nombre": "Paraguay", "region": "LATAM"},
    "BOL": {"nombre": "Bolivia", "region": "LATAM"},
    "PER": {"nombre": "Perú", "region": "LATAM"},
    "COL": {"nombre": "Colombia", "region": "LATAM"},
    "MEX": {"nombre": "México", "region": "LATAM"},
    "ECU": {"nombre": "Ecuador", "region": "LATAM"},
}


INDICADORES = {
    "pbi": {
        "codigo": "NY.GDP.MKTP.CD",
        "unidad": "USD actuales",
    },
    "pbi_per_capita": {
        "codigo": "NY.GDP.PCAP.CD",
        "unidad": "USD actuales",
    },
    "crecimiento_pbi": {
        "codigo": "NY.GDP.MKTP.KD.ZG",
        "unidad": "% anual",
    },
    "inflacion": {
        "codigo": "FP.CPI.TOTL.ZG",
        "unidad": "% anual",
    },
    "desempleo": {
        "codigo": "SL.UEM.TOTL.ZS",
        "unidad": "% población activa",
    },
    "exportaciones_pbi": {
        "codigo": "NE.EXP.GNFS.ZS",
        "unidad": "% PBI",
    },
    "importaciones_pbi": {
        "codigo": "NE.IMP.GNFS.ZS",
        "unidad": "% PBI",
    },
    "industria_pbi": {
        "codigo": "NV.IND.TOTL.ZS",
        "unidad": "% PBI",
    },
    "manufactura_pbi": {
        "codigo": "NV.IND.MANF.ZS",
        "unidad": "% PBI",
    },
    "agro_pbi": {
        "codigo": "NV.AGR.TOTL.ZS",
        "unidad": "% PBI",
    },
    "servicios_pbi": {
        "codigo": "NV.SRV.TOTL.ZS",
        "unidad": "% PBI",
    },
    "poblacion": {
        "codigo": "SP.POP.TOTL",
        "unidad": "personas",
    },
    "inversion_pbi": {
        "codigo": "NE.GDI.TOTL.ZS",
        "unidad": "% PBI",
    },
}


ANIO_DESDE = 2000
ANIO_HASTA = 2026


def descargar_fuente(pais_codigo: str, variable: str, indicador_codigo: str) -> list:
    raw_file = RAW_DIR / f"{pais_codigo}_{indicador_codigo}.json"

    url = (
        f"https://api.worldbank.org/v2/country/{pais_codigo}"
        f"/indicator/{indicador_codigo}?format=json&per_page=1000"
    )

    try:
        print(f"Descargando {pais_codigo} - {variable} desde World Bank")

        response = requests.get(
            url,
            timeout=60,
            proxies={"https": "", "http": ""},
        )
        response.raise_for_status()

        data = response.json()
        raw_file.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        print(f"[OK] Fuente descargada: {raw_file}")
        return data

    except Exception as err:
        if raw_file.exists():
            print("[WARN] No se pudo descargar la fuente, se usa copia local.")
            print(f"   Motivo: {err}")

            return json.loads(raw_file.read_text(encoding="utf-8"))

        raise RuntimeError(
            f"No se pudo descargar {pais_codigo} {variable} y no existe archivo local en {raw_file}"
        ) from err


def normalizar_respuesta_worldbank(
    data: list,
    pais_codigo: str,
    pais_nombre: str,
    region: str,
    variable: str,
    indicador_codigo: str,
    unidad: str,
) -> pd.DataFrame:

    if not isinstance(data, list) or len(data) < 2:
        return pd.DataFrame()

    registros = []

    for item in data[1]:
        anio = int(item["date"])
        valor = item["value"]

        if valor is None:
            continue

        if anio < ANIO_DESDE or anio > ANIO_HASTA:
            continue

        registros.append(
            {
                "country_code": pais_codigo,
                "country": pais_nombre,
                "region": region,
                "period_date": f"{anio}-12-31",
                "year": anio,
                "frequency": "A",
                "variable_code": variable,
                "value": float(valor),
                "unit": unidad,
                "source_code": "WB",
                "source_name": "World Bank",
                "source_indicator_code": indicador_codigo,
                "load_date": date.today().isoformat(),
            }
        )

    return pd.DataFrame(registros)

def construir_panel() -> pd.DataFrame:
    paneles = []

    for pais_codigo, pais_info in PAISES.items():
        for variable, indicador_info in INDICADORES.items():
            indicador_codigo = indicador_info["codigo"]
            unidad = indicador_info["unidad"]

            try:
                data = descargar_fuente(
                    pais_codigo=pais_codigo,
                    variable=variable,
                    indicador_codigo=indicador_codigo,
                )

                df_variable = normalizar_respuesta_worldbank(
                    data=data,
                    pais_codigo=pais_codigo,
                    pais_nombre=pais_info["nombre"],
                    region=pais_info["region"],
                    variable=variable,
                    indicador_codigo=indicador_codigo,
                    unidad=unidad,
                )

                print(f"[OK] {pais_codigo} - {variable}: {len(df_variable)} filas")

                if not df_variable.empty:
                    paneles.append(df_variable)

            except Exception as err:
                print(f"[ERROR] {pais_codigo} - {variable}: {err}")
                continue

    if not paneles:
        raise RuntimeError("No se generaron registros válidos.")

    out = pd.concat(paneles, ignore_index=True)
    out = out.sort_values(["country_code", "variable_code", "year"]).reset_index(drop=True)
    return out

def main() -> None:
    df = construir_panel()

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_FILE, index=False, encoding="utf-8-sig")

    print("[OK] Panel anual World Bank actualizado:")
    print(OUT_FILE)
    print("Filas generadas:", len(df))
    print("Últimos datos:")
    print(df.tail())


if __name__ == "__main__":
    main()