



from pathlib import Path
from datetime import date

import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[2]

DATA_DIR = BASE_DIR / "src" / "data" / "sector_externo"

BIENES_FILE = DATA_DIR / "bienes.csv"
SERVICIOS_FILE = DATA_DIR / "servicios.csv"
INGRESO_PRIMARIO_FILE = DATA_DIR / "ingreso_primario.csv"
INGRESO_SECUNDARIO_FILE = DATA_DIR / "ingreso_secundario.csv"

OUT_FILE = DATA_DIR / "cuenta_corriente.csv"


def leer_componente(path: Path, nombre_saldo: str) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"No existe el archivo: {path}")

    df = pd.read_csv(path)

    requerido = {"periodo", "anio", "trimestre", "saldo"}
    faltantes = requerido - set(df.columns)

    if faltantes:
        raise RuntimeError(f"Faltan columnas en {path.name}: {faltantes}")

    out = df[["periodo", "anio", "trimestre", "saldo"]].copy()
    out = out.rename(columns={"saldo": nombre_saldo})

    out["anio"] = pd.to_numeric(out["anio"], errors="coerce")
    out["trimestre"] = pd.to_numeric(out["trimestre"], errors="coerce")
    out[nombre_saldo] = pd.to_numeric(out[nombre_saldo], errors="coerce")

    return out


def construir_cuenta_corriente() -> pd.DataFrame:
    bienes = leer_componente(BIENES_FILE, "saldo_bienes")
    servicios = leer_componente(SERVICIOS_FILE, "saldo_servicios")
    ingreso_primario = leer_componente(
        INGRESO_PRIMARIO_FILE,
        "saldo_ingreso_primario",
    )
    ingreso_secundario = leer_componente(
        INGRESO_SECUNDARIO_FILE,
        "saldo_ingreso_secundario",
    )

    df = bienes.merge(
        servicios,
        on=["periodo", "anio", "trimestre"],
        how="inner",
    )

    df = df.merge(
        ingreso_primario,
        on=["periodo", "anio", "trimestre"],
        how="inner",
    )

    df = df.merge(
        ingreso_secundario,
        on=["periodo", "anio", "trimestre"],
        how="inner",
    )

    df["saldo_cuenta_corriente"] = (
        df["saldo_bienes"]
        + df["saldo_servicios"]
        + df["saldo_ingreso_primario"]
        + df["saldo_ingreso_secundario"]
    )

    df["fuente"] = "INDEC_BDP_C01_C03_C04_C05"
    df["fecha_carga"] = date.today().isoformat()

    df = df.sort_values(["anio", "trimestre"]).reset_index(drop=True)

    return df


def main() -> None:
    df = construir_cuenta_corriente()

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_FILE, index=False, encoding="utf-8-sig")

    print("[OK] Cuenta corriente actualizada:")
    print(OUT_FILE)
    print("Últimos datos:")
    print(df.tail())


if __name__ == "__main__":
    main()