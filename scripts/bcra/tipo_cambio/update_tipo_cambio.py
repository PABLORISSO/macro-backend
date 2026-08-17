from __future__ import annotations

import csv
import sys
from datetime import datetime, timedelta
from pathlib import Path

import requests
import urllib3

BACKEND_ROOT = Path(__file__).resolve().parents[3]
OUTPUT_DIR = BACKEND_ROOT / "src" / "data" / "tipo_cambio"

# IDs de variables BCRA:
# 5 = Tipo de cambio mayorista ($ por USD) - Comunicación A 3500
BCRA_VARIABLES = [
    {"id": 5, "nombre": "mayorista"},
    {"id": 4, "nombre": "minorista_compra"},
    {"id": 272, "nombre": "minorista_venta"},
]

ARG_DATOS_BASE = "https://api.argentinadatos.com/v1/cotizaciones/dolares"
ARG_DATOS_TIPOS = [
    {"tipo": "blue", "nombre": "blue"},
    {"tipo": "bolsa", "nombre": "mep"},
    {"tipo": "contadoconliqui", "nombre": "ccl"},
    {"tipo": "oficial", "nombre": "oficial_minorista"},
    {"tipo": "mayorista", "nombre": "mayorista_arg_datos"},
]


# Evita errores de consola en Windows al imprimir caracteres no ASCII.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def asegurar_carpeta() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def get_json(url: str):
    session = requests.Session()
    session.trust_env = False

    try:
        response = session.get(
            url,
            timeout=60,
            headers={"User-Agent": "macro-tipo-cambio-updater/1.0"},
            verify=False,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as first_error:
        # Fallback defensivo por si el entorno realmente requiere proxy.
        try:
            response = requests.get(
                url,
                timeout=60,
                headers={"User-Agent": "macro-tipo-cambio-updater/1.0"},
                verify=False,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as second_error:
            raise RuntimeError(
                f"No se pudo consultar {url}. Normal: {first_error}. Inseguro: {second_error}"
            ) from second_error


def guardar_csv(rows: list[dict], out_file: Path, header: list[str]) -> None:
    with out_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  -> {out_file} ({len(rows)} filas)")


def leer_csv_existente(file_path: Path, key_col: str = "fecha") -> dict[str, dict]:
    if not file_path.exists():
        return {}

    out: dict[str, dict] = {}
    with file_path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (row.get(key_col) or "").strip()
            if key:
                out[key] = row
    return out


def fetch_bcra_variable(id_variable: int, desde: str = "1992-01-01") -> list[dict]:
    url = f"https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/{id_variable}?Desde={desde}"
    print(f"  Consultando BCRA variable {id_variable} desde {desde}...")
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


def fetch_arg_datos(tipo: str) -> list[dict]:
    url = f"{ARG_DATOS_BASE}/{tipo}"
    print(f"  Consultando argentinadatos.com/{tipo}...")
    try:
        data = get_json(url)
    except requests.HTTPError as exc:
        raise RuntimeError(f"argentinadatos.com error {exc.response.status_code} para {tipo}") from exc

    datos = data if isinstance(data, list) else (data.get("data") or [])
    rows: list[dict] = []
    for item in datos:
        fecha = str(item.get("fecha") or item.get("date") or "")[:10]
        compra_raw = item.get("compra", item.get("buy"))
        venta_raw = item.get("venta", item.get("sell"))

        compra = None
        venta = None
        try:
            compra = float(compra_raw) if compra_raw is not None else None
        except (TypeError, ValueError):
            pass
        try:
            venta = float(venta_raw) if venta_raw is not None else None
        except (TypeError, ValueError):
            pass

        if fecha and (compra is not None or venta is not None):
            rows.append({"fecha": fecha, "compra": compra, "venta": venta})

    return sorted(rows, key=lambda x: x["fecha"])


def mergear_con_existente(existente: dict[str, dict], nuevos: list[dict], key_col: str = "fecha") -> list[dict]:
    merged = dict(existente)
    for row in nuevos:
        key = str(row.get(key_col, ""))
        if key:
            merged[key] = row
    return sorted(merged.values(), key=lambda x: str(x.get(key_col, "")))


def procesar_bcra_variable(variable: dict) -> dict:
    nombre = variable["nombre"]
    output_file = OUTPUT_DIR / f"tc_{nombre}.csv"
    existente = leer_csv_existente(output_file, "fecha")

    desde = "1992-01-01"
    if existente:
        ultima = sorted(existente.keys())[-1]
        dt = datetime.strptime(ultima, "%Y-%m-%d") - timedelta(days=30)
        desde = dt.strftime("%Y-%m-%d")

    try:
        nuevos = fetch_bcra_variable(int(variable["id"]), desde)
        merged = mergear_con_existente(
            existente,
            [{"fecha": d["fecha"], "valor": d["valor"]} for d in nuevos],
        )
        guardar_csv(merged, output_file, ["fecha", "valor"])
        return {
            "nombre": nombre,
            "ok": True,
            "filas": len(merged),
            "ultimoDato": merged[-1] if merged else None,
        }
    except Exception as err:  # noqa: BLE001
        print(f"  [WARN] No se pudo actualizar {nombre}: {err}")
        return {"nombre": nombre, "ok": False, "error": str(err)}


def procesar_arg_datos(item: dict) -> dict:
    nombre = item["nombre"]
    output_compra = OUTPUT_DIR / f"tc_{nombre}_compra.csv"
    output_venta = OUTPUT_DIR / f"tc_{nombre}_venta.csv"

    try:
        datos = fetch_arg_datos(item["tipo"])
        rows_compra = [{"fecha": d["fecha"], "valor": d["compra"]} for d in datos if d["compra"] is not None]
        rows_venta = [{"fecha": d["fecha"], "valor": d["venta"]} for d in datos if d["venta"] is not None]

        guardar_csv(rows_compra, output_compra, ["fecha", "valor"])
        guardar_csv(rows_venta, output_venta, ["fecha", "valor"])

        return {
            "nombre": nombre,
            "ok": True,
            "filas": len(datos),
            "ultimoDato": datos[-1] if datos else None,
        }
    except Exception as err:  # noqa: BLE001
        print(f"  [WARN] No se pudo actualizar {nombre}: {err}")
        return {"nombre": nombre, "ok": False, "error": str(err)}


def main() -> None:
    asegurar_carpeta()
    print("=== Actualización de Tipo de Cambio (Python) ===")
    print(f"Destino: {OUTPUT_DIR}\n")

    resultados: list[dict] = []

    print("Fuente: BCRA API")
    for variable in BCRA_VARIABLES:
        resultado = procesar_bcra_variable(variable)
        resultados.append({"fuente": "BCRA", **resultado})

    print("\nFuente: argentinadatos.com")
    for item in ARG_DATOS_TIPOS:
        resultado = procesar_arg_datos(item)
        resultados.append({"fuente": "argentinadatos", **resultado})

    print("\n=== Resumen ===")
    for r in resultados:
        if r.get("ok"):
            ultimo = r.get("ultimoDato") or {}
            valor = ultimo.get("venta", ultimo.get("valor"))
            print(f"OK {r['fuente']}/{r['nombre']}: {r['filas']} filas | último: {ultimo.get('fecha')} = {valor}")
        else:
            print(f"ERR {r['fuente']}/{r['nombre']}: {r['error']}")


if __name__ == "__main__":
    main()
