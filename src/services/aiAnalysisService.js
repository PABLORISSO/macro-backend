const { OpenAI } = require("openai");

const clientOptions = {};
if (process.env.OPENAI_BASE_URL) {
  clientOptions.baseURL = process.env.OPENAI_BASE_URL;
} else if (!process.env.OPENAI_API_KEY) {
  clientOptions.baseURL = "http://localhost:1234/v1";
}
if (process.env.OPENAI_API_KEY) {
  clientOptions.apiKey = process.env.OPENAI_API_KEY;
} else {
  clientOptions.apiKey = "lm-studio";
}

const client = new OpenAI(clientOptions);

function getAIModel() {
  return process.env.OPENAI_MODEL || (process.env.OPENAI_API_KEY ? "gpt-4o-mini" : "phi-3.1-mini-128k-instruct");
}

async function analizarDolarMepMayorista({ mepActual, mayoristActual, mepHistorico = [], mayoristHistorico = [] }) {
  try {
    // Calcular variación
    const mepPrev = mepHistorico?.[mepHistorico.length - 2]?.valor;
    const mayoristPrev = mayoristHistorico?.[mayoristHistorico.length - 2]?.valor;

    const varMep = mepPrev ? ((mepActual - mepPrev) / mepPrev * 100).toFixed(2) : "N/A";
    const varMayorist = mayoristPrev ? ((mayoristActual - mayoristPrev) / mayoristPrev * 100).toFixed(2) : "N/A";

    const brecha = ((mepActual - mayoristActual) / mayoristActual * 100).toFixed(2);

    const prompt = `Analiza como economista los siguientes datos del mercado cambiario argentino:

- Dólar Mayorista BCRA actual: $${mayoristActual}
- Variación Mayorista: ${varMayorist}%
- Dólar MEP (bolsa) actual: $${mepActual}
- Variación MEP: ${varMep}%
- Brecha MEP-Mayorista: ${brecha}%

Proporciona un análisis corto (3-5 oraciones) sobre:
1. Situación actual de la brecha cambiaria
2. Tendencia del mercado
3. Posible perspectiva próxima

Sé conciso, evita jerga excesiva.`;

    const response = await client.chat.completions.create({
      model: getAIModel(),
      messages: [
        {
          role: "system",
          content:
            "Eres un economista argentino experto en mercados cambiarios. Brindas análisis claros, precisos y accesibles.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const analisis = response.choices?.[0]?.message?.content || "";

    return {
      analisis,
      datos: {
        mepActual,
        mayoristActual,
        varMep: parseFloat(varMep),
        varMayorist: parseFloat(varMayorist),
        brecha: parseFloat(brecha),
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error en analizarDolarMepMayorista:", error.message);
    throw new Error(`Error en análisis IA: ${error.message}`);
  }
}

async function analizarAgregadosMonetarios({ series = [] }) {
  try {
    const resumen = series
      .map((s) => {
        const ultimo = s.ultimoDato;
        const penultimo = s.datos?.[s.datos.length - 2];
        const variacion =
          ultimo && penultimo
            ? (((ultimo.valor - penultimo.valor) / penultimo.valor) * 100).toFixed(2)
            : "N/A";
        const valorM = ultimo ? (ultimo.valor / 1_000_000).toFixed(0) : "N/D";
        return `- ${s.nombre}: $${valorM}M ARS (variación: ${variacion}%)`;
      })
      .join("\n");

    const prompt = `Analiza como economista los siguientes datos de agregados monetarios de Argentina al último dato disponible del BCRA:

${resumen}

Proporciona un análisis corto (3-5 oraciones) sobre:
1. Tendencia de la liquidez en el sistema
2. Qué indica el crecimiento o caída de M2/M3 privado
3. Implicancias para inflación y política monetaria

Sé conciso y claro.`;

    const response = await client.chat.completions.create({
      model: getAIModel(),
      messages: [
        {
          role: "system",
          content:
            "Eres un economista argentino experto en política monetaria. Brindas análisis claros, precisos y accesibles.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const analisis = response.choices?.[0]?.message?.content || "";

    return {
      analisis,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error en analizarAgregadosMonetarios:", error.message);
    throw new Error(`Error en análisis IA agregados: ${error.message}`);
  }
}

async function analizarActividadEconomica({
  fecha,
  varInteranual,
  varMensual,
  varTendencia,
  nivelEmae,
  nivelDesestacionalizado,
  nivelTendencia,
}) {
  try {
    const senal = calcularSenalActividad({ varMensual, varInteranual });

    const prompt = `Redactá una lectura económica breve sobre el EMAE de Argentina.

Datos disponibles:
- Último mes: ${fecha}
- Variación mensual desestacionalizada: ${varMensual}%
- Variación interanual: ${varInteranual}%
- Variación de tendencia-ciclo: ${varTendencia}%
- Señal calculada por el sistema: ${senal.etiqueta}
- Lectura base: ${senal.lectura}

Reglas:
- Escribí entre 2 y 3 oraciones.
- Máximo 90 palabras.
- No repitas todos los números.
- No uses frases genéricas como "la economía registró".
- No inventes causas.
- Tono profesional, claro y directo.
- Cerrá con una frase coherente con la señal calculada.`;

    const response = await client.chat.completions.create({
      model: getAIModel(),
      messages: [
        {
          role: "system",
          content:
            "Sos un economista argentino. Escribís análisis macroeconómicos breves, sobrios y útiles para un panel profesional.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 130,
    });

    return {
      analisis: response.choices?.[0]?.message?.content || "",
      senal,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error en analizarActividadEconomica:", error.message);
    throw new Error(`Error en análisis IA actividad: ${error.message}`);
  }
}

async function analizarActividadDinamica({
  fecha,
  varInteranual,
  varMensual,
  historialReciente = [],
}) {
  try {
    const senal = calcularSenalActividad({ varMensual, varInteranual });

    const historialTexto = historialReciente.length
      ? historialReciente
          .map(
            (item) =>
              `- ${item.fecha}: mensual ${item.varMensual}% | interanual ${item.varInteranual}%`
          )
          .join("\n")
      : "- Sin historial reciente adicional";

    const prompt = `Redactá una lectura breve de la dinámica reciente del EMAE.

Datos:
- Último mes: ${fecha}
- Variación mensual actual: ${varMensual}%
- Variación interanual actual: ${varInteranual}%
- Señal calculada por el sistema: ${senal.etiqueta}

Historial reciente:
${historialTexto}

Reglas:
- Escribí entre 2 y 3 oraciones.
- Máximo 90 palabras.
- No repitas todos los números.
- Compará el último dato contra el historial reciente.
- No inventes causas.
- Indicá si hay pérdida de impulso, recuperación o estabilidad.`;

    const response = await client.chat.completions.create({
      model: getAIModel(),
      messages: [
        {
          role: "system",
          content:
            "Sos un economista argentino. Escribís lecturas coyunturales breves, claras y sobrias para un dashboard macroeconómico.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 130,
    });

    return {
      analisis: response.choices?.[0]?.message?.content || "",
      senal,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error en analizarActividadDinamica:", error.message);
    throw new Error(`Error en análisis IA dinámica actividad: ${error.message}`);
  }
}
async function chatInflacion({ pregunta, contexto = {}, historial = [] }) {
  try {
    const { mensual, interanual, acumulada, ultimaFecha } = contexto;
    const contextStr = [
      ultimaFecha ? `Último dato disponible: ${ultimaFecha}` : null,
      Number.isFinite(Number(mensual)) ? `Inflación mensual: ${mensual}%` : null,
      Number.isFinite(Number(interanual)) ? `Inflación interanual: ${interanual}%` : null,
      Number.isFinite(Number(acumulada)) ? `Inflación acumulada en el año: ${Number(acumulada).toFixed(1)}%` : null,
    ].filter(Boolean).join('\n');

    const messages = [
      {
        role: "system",
        content: "Sos un economista argentino especializado en precios e inflación. Das respuestas claras, directas y basadas en evidencia. No superás las 4 oraciones.",
      },
    ];

    if (contextStr) {
      messages.push({
        role: "user",
        content: `Contexto del panel actual:\n${contextStr}`,
      });
      messages.push({
        role: "assistant",
        content: "Entendido, tengo en cuenta esos datos para responder.",
      });
    }

    for (const msg of historial) {
      if (msg.rol === "user" || msg.rol === "assistant") {
        messages.push({ role: msg.rol, content: msg.texto });
      }
    }

    messages.push({ role: "user", content: pregunta });

    const response = await client.chat.completions.create({
      model: getAIModel(),
      messages,
      temperature: 0.5,
      max_tokens: 300,
    });

    return {
      respuesta: response.choices?.[0]?.message?.content || "",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error en chatInflacion:", error.message);
    throw new Error(`Error en chat inflación IA: ${error.message}`);
  }
}

module.exports = {
  analizarDolarMepMayorista,
  analizarAgregadosMonetarios,
  analizarActividadEconomica,
  analizarActividadDinamica,
  chatInflacion,
};
