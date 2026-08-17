from __future__ import annotations

import argparse
import json
import subprocess
from urllib.parse import urlencode

import requests

SERIES_ID = "116.4_TCRZE_2015_D_36_4"
BASE_URL = "https://apis.datos.gob.ar/series/api/series/"


def fetch_json(url: str):
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Chequeo rápido de ITCRM desde datos.gob.ar")
    parser.add_argument("--frecuencia", choices=["mensual", "diaria"], default="mensual")
    parser.add_argument("--desde", default=None)
    parser.add_argument("--limit", type=int, default=5000)
    args = parser.parse_args()

    params = {
        "ids": SERIES_ID,
        "sort": "asc",
        "limit": str(max(args.limit, 1)),
    }

    if args.frecuencia == "mensual":
        params["collapse"] = "month"
    if args.desde:
        params["start_date"] = args.desde

    url = f"{BASE_URL}?{urlencode(params)}"

    data = fetch_json(url)
    serie = data.get("data") if isinstance(data, dict) else []

    rows = []
    for item in serie or []:
        if not isinstance(item, list) or len(item) < 2:
            continue
        fecha = item[0]
        try:
            valor = float(item[1])
        except (TypeError, ValueError):
            continue
        rows.append({"fecha": fecha, "valor": valor})

    if not rows:
        print("Sin datos para los parámetros indicados.")
        return

    primera = rows[0]
    ultima = rows[-1]
    ultimos_5 = rows[-5:]

    print("Serie:", SERIES_ID)
    print("Frecuencia:", args.frecuencia)
    print("Registros:", len(rows))
    print(f"Primera fecha: {primera['fecha']} valor: {primera['valor']:.2f}")
    print(f"Última fecha: {ultima['fecha']} valor: {ultima['valor']:.2f}")
    print("\nÚltimos 5 registros:")
    for r in ultimos_5:
        print(f"- {r['fecha']}: {r['valor']:.2f}")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:  # noqa: BLE001
        print("Error ejecutando chequeo ITCRM:", err)
        raise SystemExit(1) from err
