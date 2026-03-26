// src/app.js

document.getElementById('generate-btn').addEventListener('click', generateContent);

async function generateContent() {
    const instructionInput = document.getElementById('technical-instruction').value;
    const goalInput = document.getElementById('post-goal').value;
    const postOutput = document.getElementById('linkedin-post-output');
    const carouselContainer = document.getElementById('carousel-preview-container');
    const downloadBtn = document.getElementById('download-pdf-btn');

    if (!instructionInput) {
        alert("Por favor, escribe la instrucción técnica.");
        return;
    }

    postOutput.value = "Generando propuesta técnica (Simulada)...";
    carouselContainer.innerHTML = '<div class="carousel-placeholder">Llamando a la API simulada...</div>';
    downloadBtn.disabled = true;

    try {
        const response = await fetch('/api/generate-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                technical_instruction: instructionInput,
                goal: goalInput,
                tone: "Autoridad Técnica / Enterprise"
            })
        });

        if (!response.ok) {
            throw new Error(`Error en la API: ${response.statusText}`);
        }

        const data = await response.json();

        // 1. Mostrar el Post de LinkedIn
        postOutput.value = data.linkedin_post;

        // 2. Renderizar el Carrusel con el Estilo TEC
        renderCarouselPreview(data.carousel_data);
        
        // Activar botón de descarga (mañana implementamos la lógica PDF)
        downloadBtn.disabled = false;
        downloadBtn.textContent = "Descargar PDF (Lógica Mañana)";

    } catch (error) {
        postOutput.value = `Error: ${error.message}`;
        carouselContainer.innerHTML = '<div class="carousel-placeholder" style="color:red;">Error al generar el contenido.</div>';
    }
}

function renderCarouselPreview(carouselData) {
    const container = document.getElementById('carousel-preview-container');
    container.innerHTML = ''; 

    const logoPath = "assets/logo.png";
    const totalSlides = carouselData.slides.length;

    carouselData.slides.forEach((slide, index) => {
        const slideEl = document.createElement('div');
        slideEl.className = `slide-preview slide-${slide.type}`;
        
        const isDarkSlide = (slide.type === 'cover_bold' || slide.type === 'data_callout');
        const logoStyle = isDarkSlide ? 'style="height:50px; filter: brightness(0) invert(1);"' : 'style="height:50px;"';

        // HTML base de la flecha de navegación (se oculta en CSS para el último slide)
        const navArrowHTML = '<div class="slide-nav-arrow">→</div>';

        if (slide.type === 'cover_bold') {
            slideEl.style.backgroundImage = `url(${slide.bg_image})`;
            slideEl.innerHTML = `
                <div class="cover-overlay"></div>
                ${navArrowHTML}
                <div class="slide-branding" style="z-index:2; position:relative;">
                    <img src="${logoPath}" ${logoStyle}>
                </div>
                <h3>${slide.headline}</h3>
                <div class="slide-metric" style="z-index:2; position:relative; color:var(--smability-green); font-size:6rem; font-weight:900; margin-top: auto;">${slide.metric}</div>
                <div class="slide-footer" style="z-index:2; position:relative; color:rgba(255,255,255,0.6); font-weight:bold; margin-top:20px;">01 — CASO DE ESTUDIO</div>
            `;
        } else if (slide.type === 'split_map') {
            slideEl.innerHTML = `
                ${navArrowHTML}
                <div class="slide-branding"><img src="${logoPath}" ${logoStyle}></div>
                <h3 style="font-size: 2.5rem; color: var(--smability-blue);">${slide.headline}</h3>
                <div class="map-placeholder" style="flex-grow:1; background: linear-gradient(45deg, #eee 25%, #f9f9f9 25%, #f9f9f9 50%, #eee 50%, #eee 75%, #f9f9f9 75%, #f9f9f9 100%); background-size: 40px 40px; border: 2px solid #ddd; border-radius:12px; margin: 25px 0; display:flex; align-items:center; justify-content:center; color:#999; font-weight:bold;">[VISUALIZACIÓN DE DISPERSIÓN REAL]</div>
                <p style="font-weight: 700; font-size: 1.5rem;">${slide.supporting_text}</p>
                <div class="slide-footer" style="color:#AAA; font-weight:bold;">0${index + 1} — MODELACIÓN PREDICTIVA</div>
            `;
        } else if (slide.type === 'data_callout') {
            // El frame se genera vía CSS (::before)
            slideEl.innerHTML = `
                ${navArrowHTML}
                <div class="slide-branding"><img src="${logoPath}" ${logoStyle}></div>
                <h3>${slide.headline}</h3>
                <p>${slide.supporting_text}</p>
                <div class="slide-footer" style="color:rgba(255,255,255,0.5); font-weight:bold; margin-top:40px;">0${index + 1} — IMPACTO FINANCIERO</div>
            `;
        } else if (slide.type === 'cta_clean') {
            // No incluimos flecha aquí (se oculta vía CSS, pero mejor ser explícitos)
            slideEl.innerHTML = `
                <div class="slide-branding"><img src="${logoPath}" ${logoStyle}></div>
                <h3 style="color: var(--smability-blue); font-size: 2.8rem;">${slide.headline}</h3>
                <p style="font-size: 1.8rem; color: #666; margin-bottom: 30px;">${slide.supporting_text}</p>
                <div style="background: var(--smability-blue); color: white; padding: 25px; border-radius: 12px; font-weight: bold; text-align: center; font-size: 1.8rem; text-transform: uppercase;">AGENDAR LLAMADA TÉCNICA DE 15 MIN →</div>
            `;
        }

        container.appendChild(slideEl);
    });
}
