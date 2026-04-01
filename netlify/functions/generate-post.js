const axios = require('axios');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { technical_data, category, headline, target = 'horacio', model = 'gpt-4o', temperature = 0.55 } = JSON.parse(event.body);
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'API Key no configurada.' }) };

        // 1. CONTEXTO DE EMPRESA
        const companyContext = `
Smability SAPI de CV — Ciudad de México, fundada 2017. Director: Horacio S. Jiménez Soto.
PRODUCTOS: SMAA (IoT Aire), SMAAmicro (Patente Ibero), CHAAK (Meteorológica), AIreGPT (IA Agente).
VALIDACIÓN: Calibración UNAM ICAyCC (R²: 0.9085). Mejora MAE: 49%.
REGLAS: Primera persona, experto B2B, sin frases genéricas, máximo 300 palabras.`;

        // 2. LÓGICA DE PERSONA (Dual)
        const personaPrompt = target === 'smability' 
            ? "Eres la Cuenta Corporativa de Smability. Tono: Institucional, plural ('En Smability impulsamos...'), formal, enfocado en alianzas e industria B2B." 
            : "Eres Horacio Jiménez, Director de Smability. Tono: Experto técnico, primera persona singular ('He diseñado...', 'He validado...'), directo y con autoridad.";

        const systemPrompt = `${personaPrompt}\n${companyContext}\nResponde SOLO con JSON válido.`;

        const userPrompt = `Genera contenido para LinkedIn sobre: ${headline}. 
Datos técnicos: ${JSON.stringify(technical_data)}. 
Categoría: ${category}.

Devuelve este JSON exacto:
{
  "linkedin_post": "Texto del post aquí...",
  "hook": "Gancho para portada...",
  "stat_number": "Número clave...",
  "stat_ctx": "Contexto del número...",
  "bullets_title": "Título bullets...",
  "bullets": ["b1", "b2", "b3", "b4"],
  "insight_title": "Título insight...",
  "insight_body": "Cuerpo insight...",
  "insight_metric": "Métrica opcional",
  "insight_metric_label": "Etiqueta métrica",
  "cta_body": "Frase final...",
  "cta_label": "Botón CTA"
}`;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model,
            temperature,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        }, { 
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } 
        });

        const result = JSON.parse(response.data.choices[0].message.content);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Error:', error.message);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'Fallo en la comunicación con la IA', details: error.message }) 
        };
    }
};
