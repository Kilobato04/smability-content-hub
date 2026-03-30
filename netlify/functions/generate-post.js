const axios = require('axios');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST')
        return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { technical_data, category, headline, model = 'gpt-4o', temperature = 0.55 } = JSON.parse(event.body);
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'API Key no configurada.' }) };

        // ── Contexto de empresa — inyectado siempre ──────────
        const companyContext = `
Smability SAPI de CV — Ciudad de México, fundada 2017.
Director: Horacio S. Jiménez Soto (horaciojimenez@smability.io)
Web: smability.io

PRODUCTOS:
- SMAA: sensor IoT calidad del aire (PM2.5, PM10, CO, O3, Temp, HR, GPS). Precio: $8,400 USD (dispositivo $7,000 + PDN anual $1,400).
- SMAAmicro: versión compacta co-desarrollada con Universidad Iberoamericana CDMX. Patente conjunta IMPI en proceso.
- CHAAK: estación meteorológica IoT (viento, lluvia, presión, radiación solar). Precio: $7,600 USD.
- SMAWA: sensor nivel de agua en cisternas. Implementado en 5 cisternas Universidad Iberoamericana CDMX.
- AIreGPT: Agente IA en WhatsApp y Telegram. Respuesta < 3 segundos. Pruébalo en t.me/AireGPT_bot.
- PDN: Plataforma de Datos en la Nube. API abierta para integración.

VALIDACIÓN TÉCNICA (datos reales — NO inventar cifras distintas):
- Calibración SMAA validada por ICAyCC UNAM (evaluación oficial microsensores 2022).
- MAE antes de calibración: 17.8094 → después: 9.1185 (mejora: 49%).
- RMSE antes: 20.0733 → después: 11.8960 (mejora: 41%).
- R² sin calibrar: 0.7162 → calibrado: 0.9085 (referencia oficial CCA-SIMAT).
- Estación SIMAT referencia: $150,000-$300,000 USD. SMAA: $8,400 USD = ~4% del costo.
- 26 estaciones SIMAT para 22 millones de personas en la ZMVM.

CLIENTES Y CREDIBILIDAD (reales — mencionar cuando sea relevante):
- Gobierno: SEDEMA CDMX, SECTEI CDMX, Planta de Asfalto CDMX, Secretaría de Turismo BCS.
- Academia: Universidad Iberoamericana CDMX (patente conjunta + SMAWA), UAM Azcapotzalco, Instituto de Ingeniería UNAM, ICAyCC UNAM, Universidad Anáhuac Cancún.
- ONGs: Greenpeace México, GIZ México, GAIA Guatemala.
- Privados: AlisBio Monterrey, SkyAlert México, Water Mappers (Países Bajos).
- Respaldo institucional: Horacio Jiménez convocado en mayo 2022 por Claudia Sheinbaum (entonces Jefa de Gobierno CDMX) para análisis de contingencias ambientales con ICAyCC-UNAM y CAMegalópolis.

REGLAS ABSOLUTAS PARA EL COPY:
1. NUNCA inventar cifras que no estén en los datos técnicos proporcionados.
2. NUNCA usar frases genéricas como "soluciones IoT pueden mitigar" o "implementar tecnología puede ayudar".
3. SIEMPRE escribir en primera persona de Smability: "detectamos", "medimos", "patentamos".
4. Tono: experto B2B, directo, con autoridad técnica. Sin corporativo vacío.
5. Bullets: máximo 12 palabras cada uno, concretos y con dato si existe.
6. insight_body: máximo 2 oraciones cortas. Sin párrafos largos.
`;

        const systemPrompt = `Eres el Director de Comunicación B2B de Smability.
Escribes para directores de planta, gerentes EHS, directores de operaciones y C-suite industrial en LinkedIn.
${companyContext}
Responde SOLO con JSON válido. Sin backticks, sin texto extra.`;

        const userPrompt = `Genera contenido para un carrusel LinkedIn de 5 láminas sobre:

Datos técnicos del post: ${JSON.stringify(technical_data)}
Categoría: ${category}
Titular principal: "${headline}"

Estructura fija del carrusel:
- Lámina 1 PORTADA: gancho + titular impactante
- Lámina 2 MÉTRICA: número que golpea + contexto emocional
- Lámina 3 BULLETS: 4 puntos accionables
- Lámina 4 INSIGHT: dato + argumento breve
- Lámina 5 CTA: acción concreta

Devuelve exactamente este JSON:
{
  "linkedin_post": "Copy del post. 4-5 párrafos. Primera persona Smability. Directo. CTA al final. Máx 300 palabras.",
  "hook": "Gancho portada. Máx 10 palabras. Pregunta o dato que detiene el scroll.",
  "stat_number": "Número o valor para la métrica. Solo el número con unidad. Usa datos reales del post.",
  "stat_ctx": "Contexto emocional del número. Máx 18 palabras. Concreto, no genérico.",
  "bullets_title": "Titular bullets. Máx 6 palabras. Directo.",
  "bullets": [
    "Bullet 1: beneficio concreto con dato real. Máx 12 palabras.",
    "Bullet 2: diferenciador técnico específico. Máx 12 palabras.",
    "Bullet 3: resultado medible o caso real. Máx 12 palabras.",
    "Bullet 4: adopción fácil o integración rápida. Máx 12 palabras."
  ],
  "insight_title": "Titular insight. Máx 5 palabras. Potente.",
  "insight_body": "Exactamente 2 oraciones cortas. Técnico pero comprensible. Sin generalismos.",
  "insight_metric": "Métrica secundaria si aplica. Null si no hay.",
  "insight_metric_label": "Etiqueta de la métrica. String vacío si no aplica.",
  "cta_body": "1-2 oraciones que reducen la fricción. Máx 20 palabras. Concreto.",
  "cta_label": "Texto botón CTA. Máx 5 palabras. Verbo de acción."
}`;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model,
            temperature,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userPrompt  }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });

        let result;
        try {
            result = JSON.parse(response.data.choices[0].message.content);
        } catch {
            result = { linkedin_post: response.data.choices[0].message.content };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                linkedin_post:        result.linkedin_post        || '',
                hook:                 result.hook                 || '',
                stat_number:          result.stat_number          || '',
                stat_ctx:             result.stat_ctx             || '',
                bullets_title:        result.bullets_title        || 'Por qué importa ahora',
                bullets:              result.bullets              || [],
                insight_title:        result.insight_title        || '',
                insight_body:         result.insight_body         || '',
                insight_metric:       result.insight_metric       || null,
                insight_metric_label: result.insight_metric_label || '',
                cta_body:             result.cta_body             || '',
                cta_label:            result.cta_label            || 'Agenda una demo',
                model_used:           model
            })
        };

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Fallo OpenAI', details: error.response?.data || error.message })
        };
    }
};
