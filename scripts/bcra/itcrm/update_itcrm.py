from __future__ import annotations

import csv
import subprocess
from pathlib import Path

import pandas as pd
import requests

BASE_URL = "https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/ITCRMSerie.xlsx"

BACKEND_ROOT = Path(__file__).resolve().parents[3]
OUTPUT_DIR = BACKEND_ROOT / "src" / "data" / "itcrm"
OUTPUT_DAILY = OUTPUT_DIR / "itcrm_diario.csv"
OUTPUT_MONTHLY = OUTPUT_DIR / "itcrm_mensual.csv"


def asegurar_carpeta() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def descargar_xlsx(url: str) -> bytes:
    try:
        response = requests.get(url, timeout=90)
        response.raise_for_status()
        return response.content
    except requests.RequestException:
        result = subprocess.run(
            ["curl.exe", "--silent", "--show-error", "--location", "--fail", url],
            capture_output=True,
            check=True,
        )
        return result.stdout


def normalizar_fecha(valor) -> str | None:
    if pd.isna(valor):
        return None

    try:
        dt = pd.to_datetime(valor)
    except Exception:  # noqa: BLE001
        return None

    if pd.isna(dt):
        return None

    return dt.strftime("%Y-%m-%d")


def parse_sheet(excel_path: Path, sheet_name: str) -> list[dict]:
    raw = pd.read_excel(excel_path, sheet_name=sheet_name, header=None)
    rows: list[dict] = []

    for i in range(2, len(raw)):
        fecha = normalizar_fecha(raw.iloc[i, 0])
        valor_raw = raw.iloc[i, 1]
        try:
            valor = float(valor_raw)
        except (TypeError, ValueError):
            continue

        if not fecha:
            continue

        rows.append({"fecha": fecha, "valor": round(valor, 12)})

    rows.sort(key=lambda x: x["fecha"])
    return rows


def guardar_csv(rows: list[dict], output_file: Path) -> None:
    with output_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["fecha", "valor"])
        writer.writeheader()
        writer.writerows(rows)


def completar_mensual_con_diario(daily: list[dict], monthly: list[dict]) -> list[dict]:
    mes_actual = pd.Timestamp.now().strftime("%Y-%m")
    meses_existentes = {r["fecha"][:7] for r in monthly}

    por_mes: dict[str, dict] = {}
    for d in daily:
        mes = d["fecha"][:7]
        if mes not in por_mes:
            por_mes[mes] = {"suma": 0.0, "count": 0, "ultima_fecha": d["fecha"]}
        por_mes[mes]["suma"] += float(d["valor"])
        por_mes[mes]["count"] += 1
        por_mes[mes]["ultima_fecha"] = d["fecha"]

    monthly_completo = list(monthly)
    for mes, entry in por_mes.items():
        if mes >= mes_actual:
            continue
        if mes in meses_existentes:
            continue
        promedio = entry["suma"] / entry["count"]
        monthly_completo.append({"fecha": entry["ultima_fecha"], "valor": round(promedio, 12)})

    monthly_completo.sort(key=lambda x: x["fecha"])
    return monthly_completo


def main() -> None:
    asegurar_carpeta()

    print("Descargando ITCRM desde BCRA...")
    print(f"URL: {BASE_URL}")

    content = descargar_xlsx(BASE_URL)
    temp_file = OUTPUT_DIR / "_itcrm_tmp.xlsx"
    temp_file.write_bytes(content)
    print("Archivo descargado correctamente y parseado en memoria.")

    excel = pd.ExcelFile(temp_file)
    sheet_names = excel.sheet_names

    sheet_daily = next((n for n in sheet_names if n.lower().endswith("itcrm y bilaterales")), sheet_names[0])
    sheet_monthly = next((n for n in sheet_names if "prom. mens." in n.lower()), sheet_names[1] if len(sheet_names) > 1 else sheet_names[0])

    daily = parse_sheet(temp_file, sheet_daily)
    monthly = parse_sheet(temp_file, sheet_monthly)
    monthly_completo = completar_mensual_con_diario(daily, monthly)

    guardar_csv(daily, OUTPUT_DAILY)
    guardar_csv(monthly_completo, OUTPUT_MONTHLY)

    try:
        temp_file.unlink(missing_ok=True)
    except Exception:  # noqa: BLE001
        pass

    last_daily = daily[-1] if daily else None
    last_monthly = monthly_completo[-1] if monthly_completo else None

    print(f"Hoja diaria: {sheet_daily}")
    print(f"Filas diarias generadas: {len(daily)}")
    print(f"Archivo generado: {OUTPUT_DAILY}")
    if last_daily:
        print(f"Último dato diario: {last_daily['fecha']} = {last_daily['valor']}")

    print(f"Hoja mensual: {sheet_monthly}")
    print(f"Filas mensuales base: {len(monthly)} | con completado diario: {len(monthly_completo)}")
    print(f"Archivo generado: {OUTPUT_MONTHLY}")
    if last_monthly:
        print(f"Último dato mensual: {last_monthly['fecha']} = {last_monthly['valor']}")


if __name__ == "__main__":
    main()
