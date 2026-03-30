const axios = require('axios');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST')
        return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const {
            technical_data,
            category,
            headline,
            model = 'gpt-4o',
            temperature = 0.65
        } = JSON.parse(event.body);

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey)
            return { statusCode: 500, body: JSON.stringify({ error: 'API Key no configurada.' }) };

        const systemPrompt = `Eres el Director de Comunicación B2B de Smability, startup mexicana de IoT ambiental.
Escribes para directores de planta, gerentes EHS y C-suite industrial en LinkedIn.
Tono: experto, directo, orientado a ROI. Sin emojis excesivos. Sin hashtags genéricos.
Cada frase debe ganar su espacio. Responde SOLO con JSON válido, sin backticks ni texto extra.`;

        const userPrompt = `Genera contenido completo para un carrusel LinkedIn de 5 láminas sobre:

Datos técnicos: ${JSON.stringify(technical_data)}
Categoría: ${category}
Titular principal: "${headline}"

Estructura del carrusel (fija):
  Lámina 1 — PORTADA (cover_bold): gancho + titular
  Lámina 2 — MÉTRICA (data_callout): número impactante + contexto
  Lámina 3 — BULLETS (lista): 4 puntos accionables
  Lámina 4 — INSIGHT (split): dato + argumento
  Lámina 5 — CTA: llamada a la acción

Devuelve este JSON exacto:
{
  "linkedin_post": "Copy completo del post. 4-6 párrafos. Directo. Sin hashtags genéricos. CTA al final.",

  "hook": "Frase gancho máx 12 palabras para la portada. Puede ser pregunta o dato chocante. Ej: '¿Tu planta opera con datos de hace 2 horas?'",

  "stat_number": "Número o valor impactante relacionado al tema. Solo el número con unidad. Ej: '48h' o '$45K' o '3.5X'",
  "stat_ctx": "Frase que hace emocional ese número. Máx 20 palabras. Ej: 'El tiempo promedio que una planta opera sin saber que está en riesgo.'",

  "bullets_title": "Titular de la lámina de bullets. Máx 6 palabras. Ej: 'Por qué las plantas líderes ya lo usan'",
  "bullets": [
    "Bullet 1: beneficio concreto con dato si es posible. Máx 12 palabras.",
    "Bullet 2: diferenciador técnico. Máx 12 palabras.",
    "Bullet 3: ROI o resultado medible. Máx 12 palabras.",
    "Bullet 4: facilidad de adopción o integración. Máx 12 palabras."
  ],

  "insight_title": "Titular del insight. Máx 6 palabras. Directo. Ej: 'El modelo predice lo invisible'",
  "insight_body": "2-3 oraciones que desarrollan el insight. Técnico pero comprensible. Máx 40 palabras.",
  "insight_metric": "Métrica secundaria del insight si aplica. Puede ser null.",
  "insight_metric_label": "Etiqueta de esa métrica. Ej: 'días de anticipación'. Puede ser string vacío.",

  "cta_body": "1-2 oraciones de cierre que reducen la fricción. Máx 25 palabras. Ej: 'Sin hardware adicional. Sin contratos largos.'",
  "cta_label": "Texto del botón CTA. Máx 5 palabras con verbo. Ej: 'Agenda tu demo gratis'"
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
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
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
                bullets_title:        result.bullets_title        || '¿Por qué importa ahora?',
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
            body: JSON.stringify({
                error: 'Fallo al conectar con OpenAI',
                details: error.response?.data || error.message
            })
        };
    }
};
