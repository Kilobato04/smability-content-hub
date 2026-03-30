const axios = require('axios');

exports.handler = async (event, context) => {
  // Solo aceptamos peticiones POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const params = JSON.parse(event.body);
    // Extraemos los nuevos parámetros: model y temperature
    const { 
      technical_data, 
      category, 
      model = "gpt-4o", // Valor por defecto: gpt-4o
      temperature = 0.7  // Valor por defecto: 0.7
    } = params;

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: "API Key no configurada en las variables de entorno de Netlify." }) 
      };
    }

    console.log(`Generando post con modelo: ${model} y temperatura: ${temperature}`);

    // Llamada real a OpenAI
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: model, // Aquí puedes pasar "gpt-4", "gpt-4o", etc.
      messages: [
        {
          role: "system",
          content: "Eres el Director Técnico de Smability. Escribes en LinkedIn para directores de planta y gerentes EHS. Tu tono es experto, pragmático y enfocado en ROI. No uses hashtags genéricos ni emojis excesivos. Enfócate en por qué la modelación predictiva es superior al hardware reactivo."
        },
        {
          role: "user",
          content: `Genera un post de LinkedIn basado en estos datos técnicos: ${JSON.stringify(technical_data)}. Categoría: ${category}. El post debe ser breve, con autoridad y un CTA claro.`
        }
      ],
      temperature: temperature // Ajuste de creatividad: 0 (determinista) a 1 (creativo)
    }, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`, 
        'Content-Type': 'application/json' 
      }
    });

    const linkedinPost = response.data.choices[0].message.content;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        linkedin_post: linkedinPost,
        model_used: model,
        temp_used: temperature
      }),
    };

  } catch (error) {
    console.error("Error en la función:", error.response ? error.response.data : error.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: "Fallo al conectar con OpenAI", 
        details: error.response ? error.response.data : error.message 
      }) 
    };
  }
};
