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

    if (!carouselData || !carouselData.slides) {
        container.innerHTML = '<div class="carousel-placeholder">Error en los datos del carrusel.</div>';
        return;
    }

    const logoPath = "assets/logo.png"; // Ruta a tu logo PNG

    carouselData.slides.forEach((slide, index) => {
        const slideEl = document.createElement('div');
        slideEl.className = `slide-preview slide-${slide.type}`;
        
        // Determinar si el logo debe ser blanco o color original según el tipo de slide
        const isDarkSlide = (slide.type === 'cover_bold' || slide.type === 'data_callout');
        const logoStyle = isDarkSlide ? 'style="height:50px; filter: brightness(0) invert(1);"' : 'style="height:50px;"';

        if (slide.type === 'cover_bold') {
            slideEl.style.backgroundImage = `url(${slide.bg_image})`;
            slideEl.innerHTML = `
                <div class="cover-overlay"></div>
                <div class="slide-branding" style="z-index:2; position:relative;">
                    <img src="${logoPath}" ${logoStyle}>
                </div>
                <h3>${slide.headline}</h3>
                <div class="slide-metric" style="z-index:2; position:relative; color:var(--smability-green); font-size:4rem; font-weight:900;">${slide.metric}</div>
                <div class="slide-footer" style="z-index:2; position:relative; color:#AAA;">1 / ${carouselData.slides.length}</div>
            `;
        } else if (slide.type === 'split_map') {
            slideEl.innerHTML = `
                <div class="slide-branding">
                    <img src="${logoPath}" ${logoStyle}>
                </div>
                <h3>${slide.headline}</h3>
                <div class="map-placeholder" style="flex-grow:1; background-color:#EEE; display:flex; justify-content:center; align-items:center; color:#AAA; font-style:italic; border-radius:8px; margin: 15px 0;">[Mapa Técnico de Dispersión Real]</div>
                <p>${slide.supporting_text}</p>
                <div class="slide-footer" style="color:#AAA;">${index + 1} / ${carouselData.slides.length}</div>
            `;
        } else if (slide.type === 'data_callout') {
            slideEl.innerHTML = `
                <div class="slide-branding">
                    <img src="${logoPath}" ${logoStyle}>
                </div>
                <h3>${slide.headline}</h3>
                <p style="color:white; font-size: 1.5rem;">${slide.supporting_text}</p>
                <div class="slide-footer" style="color:#AAA;">${index + 1} / ${carouselData.slides.length}</div>
            `;
        } else if (slide.type === 'cta_clean') {
            slideEl.innerHTML = `
                <div class="slide-branding">
                    <img src="${logoPath}" ${logoStyle}>
                </div>
                <h3>${slide.headline}</h3>
                <p style="font-size: 1.5rem;">${slide.supporting_text}</p>
                <div class="cta-arrow" style="font-size:4rem; color:var(--smability-blue); font-weight: bold;">→</div>
            `;
        }

        container.appendChild(slideEl);
    });
}
