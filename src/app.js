let masterPlan = null;
let currentSelectedMonth = 3; // Abril por defecto

// --- 1. INICIALIZACIÓN ÚNICA ---
document.addEventListener('DOMContentLoaded', () => {
    init();
    
    // Configuración única de botones y selectores
    document.getElementById('month-selector').addEventListener('change', (e) => {
        currentSelectedMonth = parseInt(e.target.value);
        renderCalendar();
    });

    document.getElementById('generate-btn').addEventListener('click', generateContent);
    document.getElementById('download-pdf-btn').addEventListener('click', downloadCarouselPDF);
    
    // Botón Editar
    document.querySelector('.action-buttons .secondary').addEventListener('click', toggleEdit);
});

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

// --- 2. LÓGICA DEL CALENDARIO ---
function renderCalendar() {
    const cal = document.getElementById('calendar-grid');
    if (!cal) return;
    
    const year = 2026;
    cal.innerHTML = '';
    
    const firstDayIndex = new Date(year, currentSelectedMonth, 1).getDay();
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 
    const daysInMonth = new Date(year, currentSelectedMonth + 1, 0).getDate();

    for (let x = 0; x < startOffset; x++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'cal-day empty';
        cal.appendChild(emptyDay);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const day = document.createElement('div');
        const dateObj = new Date(year, currentSelectedMonth, i);
        const dayOfWeek = dateObj.getDay();

        day.className = 'cal-day';
        day.textContent = i;
        if (dayOfWeek === 0 || dayOfWeek === 6) day.classList.add('weekend');

        const hasPost = masterPlan.pipeline.some(p => {
            const pDate = new Date(p.fecha + "T00:00:00");
            return pDate.getMonth() === currentSelectedMonth && pDate.getDate() === i;
        });
        if (hasPost) day.classList.add('has-content');
        
        const key = `pub_${year}_${currentSelectedMonth}_${i}`;
        if (localStorage.getItem(key)) day.classList.add('published');

        day.onclick = () => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                day.classList.remove('published');
            } else {
                localStorage.setItem(key, "true");
                day.classList.add('published');
            }
        };
        cal.appendChild(day);
    }
}

// --- 3. GENERACIÓN DE CONTENIDO ---
async function generateContent() {
    const postId = document.getElementById('post-selector').value;
    if (!postId) return alert("Selecciona un post.");

    const postData = masterPlan.pipeline.find(p => p.id === postId);
    const postOutput = document.getElementById('linkedin-post-output');
    const carouselContainer = document.getElementById('carousel-preview-container');

    postOutput.value = "Generando con IA avanzada...";
    carouselContainer.innerHTML = '<div class="carousel-placeholder">Procesando...</div>';

    try {
        const response = await fetch('/api/generate-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                technical_data: postData.datos,
                category: postData.cat,
                model: "gpt-4o",
                temperature: 0.5
            })
        });
        const data = await response.json();
        postOutput.value = data.linkedin_post;
        renderCarouselPreview(postData);
        document.getElementById('download-pdf-btn').disabled = false;
    } catch (error) {
        postOutput.value = `Error: ${error.message}`;
    }
}

function renderCarouselPreview(postData) {
    const container = document.getElementById('carousel-preview-container');
    container.innerHTML = ''; 
    const logoPath = "assets/logo.png";

    postData.slides.forEach((slide, index) => {
        const slideEl = document.createElement('div');
        slideEl.className = `slide-preview slide-${slide.type}`;
        
        // Fix de imagen de fondo inmediata
        if (slide.bg) {
            slideEl.style.backgroundImage = `url(${slide.bg})`;
        }

        const isDark = (slide.type === 'cover_bold' || slide.type === 'data_callout');
        const logoStyle = isDark ? 'style="filter: brightness(0) invert(1);"' : '';
        const navArrow = (index === postData.slides.length - 1) ? '' : '<div class="slide-nav-arrow">→</div>';

        slideEl.innerHTML = `
            ${navArrow}
            <div class="slide-branding"><img src="${logoPath}" ${logoStyle} height="50"></div>
            <h3>${slide.headline}</h3>
            ${slide.metric ? `<div class="slide-metric">${slide.metric}</div>` : ''}
            ${slide.supporting_text ? `<p>${slide.supporting_text}</p>` : ''}
            <div class="slide-footer">0${index + 1} — SMABILITY TÉCNICO</div>
        `;
        container.appendChild(slideEl);
    });
}

// --- 4. DESCARGA PDF (FIX DEFINITIVO) ---
async function downloadCarouselPDF() {
    const slides = document.querySelectorAll('.slide-preview');
    if (slides.length === 0) return;

    const btn = document.getElementById('download-pdf-btn');
    btn.textContent = "Preparando láminas...";
    
    // Contenedor temporal forzado
    const worker = document.createElement('div');
    worker.style.width = '1080px';
    worker.style.position = 'absolute';
    worker.style.left = '-9999px';
    document.body.appendChild(worker);

    const promises = [];

    slides.forEach(slide => {
        const clone = slide.cloneNode(true);
        clone.style.width = '1080px';
        clone.style.height = '1080px';
        clone.style.display = 'flex';
        clone.style.flexDirection = 'column';
        clone.style.margin = '0';
        clone.style.padding = '60px';
        clone.style.boxSizing = 'border-box';
        clone.style.backgroundImage = slide.style.backgroundImage;
        clone.style.backgroundSize = 'cover';
        
        // Forzar carga de imagen
        if (slide.style.backgroundImage.includes('url')) {
            const url = slide.style.backgroundImage.slice(4, -1).replace(/"/g, "");
            const img = new Image();
            img.src = url;
            promises.push(new Promise(res => { img.onload = res; img.onerror = res; }));
        }
        worker.appendChild(clone);
    });

    await Promise.all(promises);
    
    const opt = {
        margin: 0,
        filename: 'Smability_LinkedIn.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 1, useCORS: true, width: 1080, height: 1080 * slides.length },
        jsPDF: { unit: 'px', format: [1080, 1080], orientation: 'portrait' },
        pagebreak: { mode: 'css', before: '.slide-preview' }
    };

    try {
        await html2pdf().set(opt).from(worker).save();
    } finally {
        document.body.removeChild(worker);
        btn.textContent = "Descargar PDF para LinkedIn";
    }
}

// Helper funciones
function populateSelector() {
    const selector = document.getElementById('post-selector');
    selector.innerHTML = '<option value="">Selecciona un post...</option>';
    masterPlan.pipeline.forEach(post => {
        const opt = document.createElement('option');
        opt.value = post.id;
        opt.textContent = `${post.fecha} - ${post.id}`;
        selector.appendChild(opt);
    });
}

function toggleEdit() {
    const area = document.getElementById('linkedin-post-output');
    area.readOnly = !area.readOnly;
    area.style.backgroundColor = area.readOnly ? "#F0F0F0" : "#FFF";
    this.textContent = area.readOnly ? "Editar" : "Guardar";
}
