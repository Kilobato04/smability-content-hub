// netlify/functions/generate-post.js

exports.handler = async (event, context) => {
  // Solo aceptamos peticiones POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const params = JSON.parse(event.body);
    const { technical_instruction, tone, goal } = params;

    console.log("Recibida instrucción técnica:", technical_instruction);

    // --- SIMULACIÓN DEL LLM ---
    // Aquí es donde mañana conectaríamos con OpenAI/Gemini usando tu API KEY.
    // Por hoy, simulamos una respuesta perfecta basada en tus requerimientos.

    // System Prompt Imaginario: "Eres el Director Técnico de Smability..."

    let simulatedResponse = "";

    if (technical_instruction.includes("Vitro")) {
        simulatedResponse = {
            linkedin_post: `🚨 CASO DE ESTUDIO B2B: Monterrey no puede depender solo de 'fierros'.

En abril, el riesgo de clausura por PROFEPA es alto. Una planta metalúrgica en el Bajío (simulando Vitro MTY) lo sabía.

Sus sensores fijos reportaban cumplimiento. Pero nuestro Modelo de Dispersión Gaussiana vio lo invisible: una inversión térmica inminente. 🌫️

Implementamos una estrategia híbrida:
1️⃣ Monitoreo con 2 sensores calibrados.
2️⃣ AireGPT predijo la contingencia 48 horas antes.
3️⃣ Ajuste proactivo del flujo de gas en la caldera Fase B.

Resultado Técnico: Cero excedencias de PM2.5 y $45,000 USD ahorrados en multas potenciales.

¿Tu EHS Manager sigue tomando decisiones reactivas? Modelación > Hardware.

Agenda una demo técnica de 15 min aquí. 👇
#Smability #AireIndustrial #CasosDeÉxito #MTY`,
            carousel_data: {
                company_logo: "src/assets/logo.svg",
                industry: "Industria Pesada",
                location: "Monterrey, NL",
                slides: [
                    { type: "cover_bold", headline: "CÓMO EL MODELO DE DISPERSIÓN EVITÓ UNA CLAUSURA EN MTY.", metric: "ROI: 3.5x", bg_image: "src/assets/vitro_bg.jpg" },
                    { type: "split_map", headline: "EL HARDWARE SOLO VEÍA CUMPLIMIENTO (REACTIVO).", supporting_text: "Nuestros sensores calibrados reportaban datos normales." },
                    { type: "split_map", headline: "EL MODELO PREDICE LA INVERSIÓN TÉRMICA (PROACTIVO).", supporting_text: "Visualización técnica de la pluma 48h antes." },
                    { type: "data_callout", headline: "$45k USD AHORRADOS EN MULTAS POTENCIALES.", supporting_text: "Reducción de 22% en excedencias PM2.5 sin parar operación." },
                    { type: "cta_clean", headline: "AGENDA TU DEMO TÉCNICA DE 15 MIN.", supporting_text: "Modelación > Hardware." }
                ]
            }
        };
    } else {
        // Respuesta dummy por defecto si no es Vitro
        simulatedResponse = {
            linkedin_post: "Post genérico generado por la IA sim...",
            carousel_data: { /* ... datos mínimos ... */ }
        };
    }

    // --- FIN SIMULACIÓN ---

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(simulatedResponse),
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
