// src/app.js
let masterPlan = null;

// Carga inicial al cargar el DOM
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        const res = await fetch('data/master_abril.json');
        masterPlan = await res.json();
        populateSelector();
        renderCalendar();
    } catch (e) {
        console.error("Error cargando el Plan Maestro:", e);
    }
}

function populateSelector() {
    const selector = document.getElementById('post-selector');
    selector.innerHTML = '<option value="">Selecciona un post...</option>';
    masterPlan.pipeline.forEach(post => {
        const opt = document.createElement('option');
        opt.value = post.id;
        opt.textContent = `${post.fecha} - [${post.cat}] ${post.id}`;
        selector.appendChild(opt);
    });
}

function renderCalendar() {
    const cal = document.getElementById('calendar-grid');
    cal.innerHTML = '';
    
    // Obtenemos los días que tienen posts programados del JSON
    const postedDays = masterPlan.pipeline.map(p => {
        const dateParts = p.fecha.split('-');
        return parseInt(dateParts[2]); // Extrae el día
    });

    for(let i=1; i<=30; i++) {
        const day = document.createElement('div');
        day.className = 'cal-day';
        day.textContent = i;
        
        // Resaltar solo si el día está en el pipeline de Smability
        if(postedDays.includes(i)) {
            day.classList.add('has-content');
            day.title = "Post programado";
        }
        cal.appendChild(day);
    }
}

document.getElementById('generate-btn').addEventListener('click', generateContent);

async function generateContent() {
    const postId = document.getElementById('post-selector').value;
    if (!postId) {
        alert("Selecciona un post del calendario.");
        return;
    }

    const postData = masterPlan.pipeline.find(p => p.id === postId);
    const postOutput = document.getElementById('linkedin-post-output');
    const carouselContainer = document.getElementById('carousel-preview-container');
    const downloadBtn = document.getElementById('download-pdf-btn');

    postOutput.value = "Generando propuesta técnica con IA avanzada...";
    carouselContainer.innerHTML = '<div class="carousel-placeholder">Procesando slides...</div>';

    try {
        // Mañana esta llamada conectará con el Token real de GPT-4o
        const response = await fetch('/api/generate-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                post_id: postData.id,
                technical_data: postData.datos,
                category: postData.cat
            })
        });

        const data = await response.json();
        postOutput.value = data.linkedin_post;
        renderCarouselPreview(postData); // Usamos la estructura definida en el JSON
        
        downloadBtn.disabled = false;
        downloadBtn.textContent = "Descargar PDF para LinkedIn";

    } catch (error) {
        postOutput.value = `Error: ${error.message}`;
    }
}

// --- src/app.js ---
function renderCarouselPreview(carouselData) {
    const container = document.getElementById('carousel-preview-container');
    container.innerHTML = ''; 

    const logoPath = "assets/logo.png";
    const slides = carouselData.slides;

    slides.forEach((slide, index) => {
        const slideEl = document.createElement('div');
        slideEl.className = `slide-preview slide-${slide.type}`;
        
        const isDarkSlide = (slide.type === 'cover_bold' || slide.type === 'data_callout');
        const logoStyle = isDarkSlide ? 'style="height:50px; filter: brightness(0) invert(1);"' : 'style="height:50px;"';

        // LÓGICA DE LA FLECHA: Solo si NO es el último slide
        const isLastSlide = (index === slides.length - 1);
        const navArrowHTML = isLastSlide ? '' : '<div class="slide-nav-arrow">→</div>';

        if (slide.type === 'cover_bold') {
            slideEl.style.backgroundImage = `url(${slide.bg_image})`;
            slideEl.innerHTML = `
                <div class="cover-overlay"></div>
                ${navArrowHTML} 
                <div class="slide-branding" style="z-index:2; position:relative;">
                    <img src="${logoPath}" ${logoStyle}>
                </div>
                <h3 style="z-index:2; position:relative;">${slide.headline}</h3>
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
            slideEl.innerHTML = `
                ${navArrowHTML}
                <div class="slide-branding"><img src="${logoPath}" ${logoStyle}></div>
                <h3>${slide.headline}</h3>
                <p>${slide.supporting_text}</p>
                <div class="slide-footer" style="color:rgba(255,255,255,0.5); font-weight:bold; margin-top:40px;">0${index + 1} — IMPACTO FINANCIERO</div>
            `;
        } else if (slide.type === 'cta_clean') {
            // Sin navArrowHTML aquí por la lógica isLastSlide
            slideEl.innerHTML = `
                <div class="slide-branding"><img src="${logoPath}" ${logoStyle}></div>
                <h3 style="color: var(--smability-blue); font-size: 2.8rem;">${slide.headline}</h3>
                <p style="font-size: 1.8rem; color: #666; margin-bottom: 30px;">${slide.supporting_text}</p>
                <div style="background: var(--smability-blue); color: white; padding: 25px; border-radius: 12px; font-weight: bold; text-align: center; font-size: 1.8rem; text-transform: uppercase;">AGENDAR LLAMADA TÉCNICA →</div>
            `;
        }

        container.appendChild(slideEl);
    });
}


document.getElementById('download-pdf-btn').addEventListener('click', async () => {
    const element = document.getElementById('carousel-preview-container');
    const downloadBtn = document.getElementById('download-pdf-btn');
    
    // Clonamos temporalmente para limpiar estilos de scroll que arruinan la captura
    const contentToPrint = element.cloneNode(true);
    contentToPrint.style.height = 'auto';
    contentToPrint.style.maxHeight = 'none';
    contentToPrint.style.overflow = 'visible';
    
    downloadBtn.textContent = "Generando PDF...";
    
    const opt = {
        margin:       0,
        filename:     `Smability_Carrusel_${new Date().getTime()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2, 
            useCORS: true,
            logging: false,
            scrollY: 0,
            scrollX: 0
        },
        jsPDF:        { unit: 'px', format: [1080, 1080], orientation: 'portrait' },
        pagebreak:    { mode: 'css', before: '.slide-preview' } 
    };

    try {
        await html2pdf().set(opt).from(contentToPrint).save();
        downloadBtn.textContent = "Descargar PDF para LinkedIn";
    } catch (e) {
        console.error("Error generando PDF:", e);
        alert("Error al generar el PDF.");
        downloadBtn.textContent = "Descargar PDF para LinkedIn";
    }
});
