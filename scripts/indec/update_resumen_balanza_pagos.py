from pathlib import Path
from datetime import date

import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[2]

DATA_DIR = BASE_DIR / "src" / "data" / "sector_externo"

CUENTA_CORRIENTE_FILE = DATA_DIR / "cuenta_corriente.csv"
CUENTA_CAPITAL_FILE = DATA_DIR / "cuenta_capital.csv"
CUENTA_FINANCIERA_FILE = DATA_DIR / "cuenta_financiera.csv"

OUT_FILE = DATA_DIR / "resumen_balanza_pagos.csv"


def leer_columna(path: Path, columna_valor: str, nuevo_nombre: str) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"No existe el archivo: {path}")

    df = pd.read_csv(path)

    requerido = {"periodo", "anio", "trimestre", columna_valor}
    faltantes = requerido - set(df.columns)

    if faltantes:
        raise RuntimeError(f"Faltan columnas en {path.name}: {faltantes}")

    out = df[["periodo", "anio", "trimestre", columna_valor]].copy()
    out = out.rename(columns={columna_valor: nuevo_nombre})

    out["anio"] = pd.to_numeric(out["anio"], errors="coerce")
    out["trimestre"] = pd.to_numeric(out["trimestre"], errors="coerce")
    out[nuevo_nombre] = pd.to_numeric(out[nuevo_nombre], errors="coerce")

    return out


def construir_resumen() -> pd.DataFrame:
    cuenta_corriente = leer_columna(
        CUENTA_CORRIENTE_FILE,
        "saldo_cuenta_corriente",
        "saldo_cuenta_corriente",
    )

    cuenta_capital = leer_columna(
        CUENTA_CAPITAL_FILE,
        "cuenta_capital",
        "cuenta_capital",
    )

    cuenta_financiera = leer_columna(
        CUENTA_FINANCIERA_FILE,
        "cuenta_financiera",
        "cuenta_financiera",
    )

    df = cuenta_corriente.merge(
        cuenta_capital,
        on=["periodo", "anio", "trimestre"],
        how="inner",
    )

    df = df.merge(
        cuenta_financiera,
        on=["periodo", "anio", "trimestre"],
        how="inner",
    )

    df["saldo_global"] = (
        df["saldo_cuenta_corriente"]
        + df["cuenta_capital"]
        + df["cuenta_financiera"]
    )

    df["fuente"] = "INDEC_BDP_RESUMEN"
    df["fecha_carga"] = date.today().isoformat()

    df = df.sort_values(["anio", "trimestre"]).reset_index(drop=True)

    return df


def main() -> None:
    df = construir_resumen()

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_FILE, index=False, encoding="utf-8-sig")

    print("[OK] Resumen Balanza de Pagos actualizado:")
    print(OUT_FILE)
    print("Últimos datos:")
    print(df.tail())


if __name__ == "__main__":
    main()