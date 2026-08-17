const fs = require("fs");
const path = require("path");
const https = require("https");

const url =
  "https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/categories/catv00001255?filters%5Bgroup_id%5D=catv00001255&key=key_r6xzz4IAoTWcipni&num_results_per_page=24&pre_filter_expression=%7B%22name%22:%22store_availability%22,%22value%22:%22200%22%7D&c=cio-fe-web-coto-3.5.2&i=3d8d4087-66d5-4409-b554-2162b376b8f3&s=1&origin_referrer=/sitios/cdigi/productos/categorias/frescos/catv00001255";

function buildHttpsAgent() {
  const caPath = process.env.COTO_CA_CERT_PATH || process.env.NODE_EXTRA_CA_CERTS;
  const insecureTls = process.env.COTO_ALLOW_INSECURE_TLS === "1";

  if (insecureTls) {
    console.warn(
      "[WARN] COTO_ALLOW_INSECURE_TLS=1 activo: TLS inseguro habilitado solo para pruebas locales."
    );
    return new https.Agent({ rejectUnauthorized: false });
  }

  if (!caPath) {
    return new https.Agent({ rejectUnauthorized: true });
  }

  const resolvedCaPath = path.resolve(caPath);
  if (!fs.existsSync(resolvedCaPath)) {
    throw new Error(`No existe el certificado CA en: ${resolvedCaPath}`);
  }

  const ca = fs.readFileSync(resolvedCaPath, "utf8");
  return new https.Agent({ rejectUnauthorized: true, ca });
}

function fetchJsonWithHttps(endpoint, agent) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      endpoint,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
        agent,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(
              new Error(`HTTP ${response.statusCode}: ${body.slice(0, 300)}`)
            );
          }

          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error(`Respuesta JSON inválida: ${err.message}`));
          }
        });
      }
    );

    request.on("error", reject);
    request.end();
  });
}

async function main() {
  const agent = buildHttpsAgent();
  const json = await fetchJsonWithHttps(url, agent);

  const products = json.response.results.map((item) => {
    const data = item.data;

    return {
      id: data.id,
      sku_id: data.sku_id,
      nombre: data.sku_display_name,
      descripcion: data.sku_description,
      ean: data.product_main_ean,
      formato: data.product_format,
      unidad: data.product_unit_of_measure,
      precio_lista: data.product_list_price,
      imagen: data.image_url,
    };
  });

  console.log("Productos:", products.length);
  console.table(products.slice(0, 5));

  const outputDir = path.resolve(__dirname, "../../data/ipconline");
  const outputFile = path.join(outputDir, "productos_coto_prueba.json");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(products, null, 2), "utf8");

  console.log(`Archivo guardado en: ${outputFile}`);
}

main().catch((err) => {
  const tlsCode = err?.code;
  const isTlsError =
    tlsCode === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" ||
    tlsCode === "SELF_SIGNED_CERT_IN_CHAIN" ||
    tlsCode === "DEPTH_ZERO_SELF_SIGNED_CERT";

  if (isTlsError) {
    console.error("Error TLS al conectar con Coto:", err.message);
    console.error(
      "Solución recomendada: exportar COTO_CA_CERT_PATH con la ruta a tu CA corporativa en formato PEM."
    );
    console.error(
      "Ejemplo PowerShell: $env:COTO_CA_CERT_PATH='C:\\certs\\empresa-ca.pem'; node scripts\\ipconline\\update_coto_prueba.js"
    );
    return;
  }

  console.error(err);
});