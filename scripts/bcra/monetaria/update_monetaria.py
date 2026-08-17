from __future__ import annotations

import csv
import json
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

import requests

BACKEND_ROOT = Path(__file__).resolve().parents[3]
OUTPUT_DIR = BACKEND_ROOT / "src" / "data" / "monetaria"

AGREGADOS_MONETARIOS = [
    {"idVariable": 15, "slug": "base-monetaria", "nombre": "Base monetaria"},
    {"idVariable": 17, "slug": "circulante-publico", "nombre": "Circulante en poder del público"},
    {"idVariable": 91, "slug": "depositos-totales", "nombre": "Depósitos totales"},
    {"idVariable": 109, "slug": "m2-total", "nombre": "M2 total"},
    {"idVariable": 197, "slug": "m2-privado", "nombre": "M2 privado"},
    {"idVariable": 96, "slug": "_plazo-fijo-privado", "nombre": "Plazos fijos privados"},
]


def asegurar_carpeta() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def get_json(url: str):
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        result = subprocess.run(
            ["curl.exe", "--silent", "--show-error", "--location", "--fail", url],
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout)


def guardar_csv(rows: list[dict], out_file: Path, header: list[str]) -> None:
    with out_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        writer.writerows(rows)


def leer_csv_existente(file_path: Path) -> dict[str, dict]:
    if not file_path.exists():
        return {}

    out: dict[str, dict] = {}
    with file_path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fecha = (row.get("fecha") or "").strip()
            valor_raw = row.get("valor")
            if not fecha:
                continue
            try:
                valor = float(valor_raw)
            except (TypeError, ValueError):
                continue
            out[fecha] = {"fecha": fecha, "valor": valor}

    return out


def mergear_con_existente(existente: dict[str, dict], nuevos: list[dict]) -> list[dict]:
    merged = dict(existente)
    for row in nuevos:
        fecha = row.get("fecha")
        if fecha:
            merged[str(fecha)] = row
    return sorted(merged.values(), key=lambda x: x["fecha"])


def fetch_bcra_variable(id_variable: int, desde: str = "1992-01-01") -> list[dict]:
    url = f"https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/{id_variable}?Desde={desde}"
    try:
        data = get_json(url)
    except requests.HTTPError as exc:
        raise RuntimeError(f"BCRA API error {exc.response.status_code} para variable {id_variable}") from exc

    detalle = ((data.get("results") or [{}])[0].get("detalle") or [])
    rows = []
    for item in detalle:
        fecha = str(item.get("fecha", ""))[:10]
        try:
            valor = float(item.get("valor"))
        except (TypeError, ValueError):
            continue
        if fecha:
            rows.append({"fecha": fecha, "valor": valor})
    return sorted(rows, key=lambda x: x["fecha"])


def procesar_serie(serie: dict) -> dict:
    output_file = OUTPUT_DIR / f"agregado_{serie['slug']}.csv"
    existente = leer_csv_existente(output_file)

    desde = "1992-01-01"
    if existente:
        ultima = sorted(existente.keys())[-1]
        dt = datetime.strptime(ultima, "%Y-%m-%d") - timedelta(days=30)
        desde = dt.strftime("%Y-%m-%d")

    nuevos = fetch_bcra_variable(int(serie["idVariable"]), desde)
    merged = mergear_con_existente(existente, nuevos)
    guardar_csv(merged, output_file, ["fecha", "valor"])

    return {
        "idVariable": serie["idVariable"],
        "slug": serie["slug"],
        "nombre": serie["nombre"],
        "filas": len(merged),
        "ultimoDato": merged[-1] if merged else None,
        "outputFile": str(output_file),
    }


def main() -> None:
    asegurar_carpeta()
    print("=== Actualización Agregados Monetarios (Python) ===")

    resultados: list[dict] = []
    for serie in AGREGADOS_MONETARIOS:
        try:
            out = procesar_serie(serie)
            resultados.append({"ok": True, **out})
            ultimo = out.get("ultimoDato") or {}
            print(f"✓ {out['slug']}: {out['filas']} filas | último {ultimo.get('fecha')} = {ultimo.get('valor')}")
        except Exception as err:  # noqa: BLE001
            resultados.append({"ok": False, "slug": serie["slug"], "error": str(err)})
            print(f"✗ {serie['slug']}: {err}")

    if any(not r.get("ok") for r in resultados):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
