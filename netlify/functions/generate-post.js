const axios = require('axios');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST')
        return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { technical_data, category, slides = [], model = 'gpt-4o', temperature = 0.6 } = JSON.parse(event.body);
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'API Key no configurada.' }) };

        // ── Prompt del sistema ───────────────────────────────
        const systemPrompt = `Eres el Director de Comunicación B2B de Smability.
Escribes para directores de planta, gerentes EHS y tomadores de decisión industriales en LinkedIn.
Tu tono: experto, directo, orientado a ROI. Sin emojis excesivos. Sin hashtags genéricos.
Cada frase debe ganar su espacio — si no aporta, no va.`;

        // ── Prompt del usuario ───────────────────────────────
        const userPrompt = `Genera contenido para un carrusel de LinkedIn de ${slides.length} láminas sobre:
Datos técnicos: ${JSON.stringify(technical_data)}
Categoría: ${category}

Láminas del carrusel:
${slides.map((s, i) => `  Lámina ${i+1} (${s.type}): "${s.headline}"${s.metric ? ` — Métrica: ${s.metric}` : ''}`).join('\n')}

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta (sin backticks, sin texto extra):
{
  "linkedin_post": "Copy completo del post para LinkedIn. 3-5 párrafos. Directo. CTA al final.",
  "slide_messages": [
    {
      "hook": "Frase gancho corta (max 12 palabras) para la portada — tipo titular de revista. Puede ser una pregunta o dato chocante.",
      "body": "1-2 oraciones de desarrollo o insight accionable (max 30 palabras).",
      "stat_ctx": "Contexto que hace la métrica emocional o relevante (ej: 'Equivale a 7 cigarrillos al día').",
      "cta_label": "Texto del botón CTA (max 6 palabras, verbo de acción)"
    }
  ]
}

Genera un objeto en slide_messages por cada lámina, en el mismo orden.
Para láminas sin métrica, deja stat_ctx como cadena vacía.
Para láminas que no son CTA, deja cta_label como cadena vacía.`;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model,
            temperature,
            response_format: { type: 'json_object' }, // fuerza JSON válido en gpt-4o
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userPrompt  }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });

        // Parsear respuesta JSON
        let result;
        try {
            result = JSON.parse(response.data.choices[0].message.content);
        } catch {
            // Fallback si el modelo no respetó el formato
            result = {
                linkedin_post: response.data.choices[0].message.content,
                slide_messages: []
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                linkedin_post:  result.linkedin_post  || '',
                slide_messages: result.slide_messages || [],
                model_used:     model
            })
        };

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Fallo al conectar con OpenAI', details: error.response?.data || error.message })
        };
    }
};
