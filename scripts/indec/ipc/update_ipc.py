
import argparse
import csv
import re
import subprocess
from datetime import datetime
from io import BytesIO
from pathlib import Path

import pandas as pd
import requests

BASE_URL = "https://www.indec.gob.ar/ftp/cuadros/economia"

BACKEND_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = BACKEND_ROOT / "data" / "ipc"
OUTPUT_DIR = BACKEND_ROOT / "src" / "data" / "ipc"
OUTPUT_FILE = OUTPUT_DIR / "ipc_aperturas_largo.csv"
OUTPUT_FILE_INTERANUAL = OUTPUT_DIR / "ipc_interanual_largo.csv"

CONCEPTOS_VALIDOS = {
    "Nivel general",
    "Alimentos y bebidas no alcohólicas",
    "Bebidas alcohólicas y tabaco",
    "Prendas de vestir y calzado",
    "Vivienda, agua, electricidad, gas y otros combustibles",
    "Equipamiento y mantenimiento del hogar",
    "Salud",
    "Transporte",
    "Comunicación",
    "Recreación y cultura",
    "Educación",
    "Restaurantes y hoteles",
    "Bienes y servicios varios",
    "Estacional",
    "Núcleo",
    "Regulados",
    "Bienes",
    "Servicios",
}


def armar_nombres_posibles(anio, mes):
    yy = str(anio)[-2:]

    return [
        f"sh_ipc_{mes:02d}_{yy}.xls",
        f"sh_ipc_{mes:02d}_{yy}.xlsx",
        f"ipc_{mes:02d}_{yy}.xls",
        f"ipc_{mes:02d}_{yy}.xlsx",
        f"sh_ipc_{mes}_{yy}.xls",
        f"sh_ipc_{mes}_{yy}.xlsx",
    ]


def es_excel_valido(content: bytes) -> bool:
    if not content or len(content) < 1000:
        return False

    return (
        content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1")
        or content.startswith(b"PK\x03\x04")
    )


def descargar_archivo(url: str) -> bytes:
    print(f"Intentando descargar: {url}")

    try:
        response = requests.get(
            url,
            timeout=90,
            proxies={"https": "", "http": ""},
            headers={"User-Agent": "Mozilla/5.0"},
        )

        print("Status requests:", response.status_code)
        response.raise_for_status()

        if not es_excel_valido(response.content):
            raise RuntimeError("La respuesta no parece ser un Excel válido.")

        return response.content

    except Exception as err:
        print("Falló requests:")
        print(err)

    try:
        print("Intentando con curl...")
        result = subprocess.run(
            [
                "curl.exe",
                "--silent",
                "--show-error",
                "--location",
                "--fail",
                url,
            ],
            capture_output=True,
            check=True,
        )

        if not es_excel_valido(result.stdout):
            raise RuntimeError("La descarga por curl no parece ser un Excel válido.")

        return result.stdout

    except Exception as err:
        print("Falló curl:")
        print(err)
        raise RuntimeError(f"No se pudo descargar el archivo desde: {url}") from err


def buscar_y_descargar_ipc(anio: int, mes: int) -> tuple[str, bytes]:
    print("Descargando IPC desde INDEC...")

    errores = []

    for archivo in armar_nombres_posibles(anio, mes):
        url = f"{BASE_URL}/{archivo}"
        print(f"\nProbando URL: {url}")

        try:
            content = descargar_archivo(url)
            print(f"[OK] Archivo encontrado: {archivo}")
            return archivo, content
        except Exception as err:
            errores.append(f"{archivo}: {err}")
            print(f"[WARN] No se pudo descargar {archivo}")

    print("\nNo se encontró archivo IPC válido. Intentos realizados:")
    for err in errores:
        print("-", err)

    raise RuntimeError("No se encontró ningún archivo IPC válido para ese mes.")


def normalizar_texto(valor) -> str:
    return re.sub(r"\s+", " ", str(valor or "")).strip()


def limpiar_concepto(valor) -> str:
    return re.sub(r"\*+$", "", normalizar_texto(valor)).strip()


def convertir_fecha(valor) -> str | None:
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return None

    if isinstance(valor, datetime):
        return valor.strftime("%Y-%m")

    if isinstance(valor, pd.Timestamp):
        if pd.isna(valor):
            return None
        return valor.strftime("%Y-%m")

    if isinstance(valor, (int, float)):
        if valor < 30000:
            return None
        try:
            d = pd.to_datetime(valor, unit="D", origin="1899-12-30")
            return d.strftime("%Y-%m")
        except Exception:
            return None

    if isinstance(valor, str):
        texto = normalizar_texto(valor)
        m = re.match(r"^(\d{1,2})/(\d{2})$", texto)
        if m:
            mes = int(m.group(1))
            anio = int(m.group(2))
            if 1 <= mes <= 12:
                return f"20{anio:02d}-{mes:02d}"

        try:
            parsed = pd.to_datetime(texto)
            if pd.isna(parsed):
                return None
            return parsed.strftime("%Y-%m")
        except Exception:
            return None

    return None


def convertir_numero(valor) -> float | None:
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return None

    if isinstance(valor, (int, float)):
        return float(valor)

    texto = str(valor).replace(".", "").replace(",", ".").strip()

    if not texto:
        return None

    try:
        return float(texto)
    except ValueError:
        return None


def detectar_tipo_variacion(sheet_data: list[list]) -> str:
    top = " ".join(
        normalizar_texto(c)
        for fila in sheet_data[:10]
        for c in fila
    ).lower()

    if "interanual" in top:
        return "interanual"

    if "mensual" in top:
        return "mensual"

    if "acumulad" in top:
        return "acumulada"

    return "sin_identificar"


def es_region(texto: str) -> bool:
    t = normalizar_texto(texto)

    return t == "Total nacional" or t.startswith("Región") or t in {
        "GBA",
        "Pampeana",
        "Noreste",
        "Noroeste",
        "Cuyo",
        "Patagonia",
    }


def detectar_bloque(texto: str) -> str | None:
    t = normalizar_texto(texto).lower()

    if "nivel general" in t or "divisiones" in t:
        return "Nivel general"

    if "categor" in t:
        return "Categorías"

    if "bienes y servicios" in t:
        return "Bienes y servicios"

    return None


def encontrar_columnas_fecha(fila: list) -> list[dict]:
    out: list[dict] = []

    for idx, celda in enumerate(fila):
        fecha = convertir_fecha(celda)

        if fecha:
            out.append({"index": idx, "fecha": fecha})

    return out


def encontrar_concepto_en_fila(fila: list) -> str | None:
    for celda in fila:
        texto = limpiar_concepto(celda)

        if texto in CONCEPTOS_VALIDOS:
            return texto

    return None


def write_csv(out_file: Path, rows: list[dict]) -> None:
    out_file.parent.mkdir(parents=True, exist_ok=True)

    header = [
        "fecha",
        "region",
        "tipo_variacion",
        "bloque",
        "concepto",
        "valor",
        "archivo_origen",
        "fecha_descarga",
    ]

    with out_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        writer.writerows(rows)


def parse_sheet_to_rows(
    df: pd.DataFrame,
    archivo_origen: str,
) -> tuple[list[dict], str]:
    sheet_data = df.fillna("").values.tolist()
    tipo_variacion = detectar_tipo_variacion(sheet_data)

    region_actual = ""
    bloque_actual = ""
    columnas_fecha_actuales: list[dict] = []
    fecha_descarga = datetime.now().strftime("%Y-%m-%d")

    resultados: list[dict] = []

    for fila in sheet_data:
        columnas_fecha = encontrar_columnas_fecha(fila)

        if len(columnas_fecha) >= 3:
            columnas_fecha_actuales = columnas_fecha

        textos_fila = [
            normalizar_texto(x)
            for x in fila
            if normalizar_texto(x)
        ]

        for texto in textos_fila:
            if es_region(texto):
                region_actual = texto
                bloque_actual = ""

            bloque_detectado = detectar_bloque(texto)
            if bloque_detectado:
                bloque_actual = bloque_detectado

        concepto = encontrar_concepto_en_fila(fila)

        if (
            not concepto
            or not region_actual
            or not bloque_actual
            or not columnas_fecha_actuales
        ):
            continue

        for col in columnas_fecha_actuales:
            idx = col["index"]
            valor = convertir_numero(fila[idx] if idx < len(fila) else None)

            if valor is None:
                continue

            resultados.append(
                {
                    "fecha": col["fecha"],
                    "region": region_actual,
                    "tipo_variacion": tipo_variacion,
                    "bloque": bloque_actual,
                    "concepto": concepto,
                    "valor": valor,
                    "archivo_origen": archivo_origen,
                    "fecha_descarga": fecha_descarga,
                }
            )

    return resultados, tipo_variacion


def actualizar_ipc(anio: int, mes: int) -> None:
    archivo, content = buscar_y_descargar_ipc(anio, mes)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / archivo).write_bytes(content)

    print("\nArchivo descargado correctamente y parseado en memoria:")
    print(archivo)

    xls = pd.ExcelFile(BytesIO(content))

    if not xls.sheet_names:
        raise RuntimeError("El archivo IPC no contiene hojas.")

    df0 = pd.read_excel(
        BytesIO(content),
        sheet_name=xls.sheet_names[0],
        header=None,
    )

    rows0, tipo0 = parse_sheet_to_rows(df0, archivo)
    write_csv(OUTPUT_FILE, rows0)

    print("Parse IPC terminado.")
    print(f"Hoja leída: {xls.sheet_names[0]}")
    print(f"Tipo de variación detectada: {tipo0}")
    print(f"Filas generadas: {len(rows0)}")
    print(f"Archivo generado: {OUTPUT_FILE}")

    if len(xls.sheet_names) > 1:
        df1 = pd.read_excel(
            BytesIO(content),
            sheet_name=xls.sheet_names[1],
            header=None,
        )

        rows1, tipo1 = parse_sheet_to_rows(df1, archivo)
        write_csv(OUTPUT_FILE_INTERANUAL, rows1)

        print("Parse IPC terminado.")
        print(f"Hoja leída: {xls.sheet_names[1]}")
        print(f"Tipo de variación detectada: {tipo1}")
        print(f"Filas generadas: {len(rows1)}")
        print(f"Archivo generado: {OUTPUT_FILE_INTERANUAL}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Actualizar IPC INDEC")
    parser.add_argument("anio", type=int)
    parser.add_argument("mes", type=int)
    args = parser.parse_args()

    if args.mes < 1 or args.mes > 12:
        raise SystemExit("Mes inválido.")

    actualizar_ipc(args.anio, args.mes)


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print("\nError actualizando IPC:")
        print(err)
        raise SystemExit(1) from err