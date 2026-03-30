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
        
        // Forzamos el fondo desde el inicio para evitar parpadeos
        if (slide.bg) {
            slideEl.style.backgroundImage = `url(${slide.bg})`;
            slideEl.style.backgroundSize = 'cover';
            slideEl.style.backgroundPosition = 'center';
        }

        const isDark = (slide.type === 'cover_bold' || slide.type === 'data_callout');
        const logoStyle = isDark ? 'style="filter: brightness(0) invert(1);"' : '';
        const navArrow = (index === postData.slides.length - 1) ? '' : '<div class="slide-nav-arrow">→</div>';

        // Estructura con z-index explícito para evitar desformateo
        slideEl.innerHTML = `
            <div class="slide-content-wrapper" style="position:relative; z-index:10; width:100%; height:100%; display:flex; flex-direction:column; justify-content:space-between;">
                ${slide.type === 'cover_bold' ? '<div class="cover-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:-1;"></div>' : ''}
                ${navArrow}
                <div class="slide-branding"><img src="${logoPath}" ${logoStyle} height="50"></div>
                <div class="slide-body">
                    <h3 style="margin:0;">${slide.headline}</h3>
                    ${slide.metric ? `<div class="slide-metric" style="color:var(--smability-green); font-size:5rem; font-weight:900;">${slide.metric}</div>` : ''}
                    ${slide.supporting_text ? `<p style="font-size:1.5rem;">${slide.supporting_text}</p>` : ''}
                </div>
                <div class="slide-footer">0${index + 1} — SMABILITY TÉCNICO</div>
            </div>
        `;
        container.appendChild(slideEl);
    });
}

// --- 4. DESCARGA PDF (FIX DEFINITIVO) ---
async function downloadCarouselPDF() {
    const slides = document.querySelectorAll('.slide-preview');
    if (slides.length === 0) return;

    const btn = document.getElementById('download-pdf-btn');
    btn.textContent = "Renderizando láminas...";
    btn.disabled = true;
    
    const worker = document.createElement('div');
    worker.id = "pdf-worker";
    worker.style.width = '1080px';
    worker.style.position = 'fixed';
    worker.style.left = '-2000px';
    worker.style.top = '0';
    document.body.appendChild(worker);

    const promises = [];

    slides.forEach(slide => {
        const clone = slide.cloneNode(true);
        clone.style.width = '1080px';
        clone.style.height = '1080px';
        clone.style.display = 'flex';
        clone.style.margin = '0';
        clone.style.padding = '60px';
        clone.style.boxSizing = 'border-box';
        clone.style.pageBreakAfter = 'always';
        clone.style.position = 'relative';
        
        // Asegurar que el fondo se herede correctamente en el clon
        clone.style.backgroundImage = slide.style.backgroundImage;
        
        if (slide.style.backgroundImage.includes('url')) {
            const url = slide.style.backgroundImage.slice(4, -1).replace(/"/g, "");
            const img = new Image();
            img.src = url;
            promises.push(new Promise(res => { img.onload = res; img.onerror = res; }));
        }
        worker.appendChild(clone);
    });

    try {
        await Promise.all(promises);
        // Pequeña pausa para asegurar que el DOM del worker esté listo
        await new Promise(resolve => setTimeout(resolve, 500));
        
        btn.textContent = "Generando archivo...";
        
        const opt = {
            margin: 0,
            filename: 'Smability_LinkedIn_Carrusel.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 1, 
                useCORS: true, 
                width: 1080, 
                height: 1080 * slides.length,
                scrollY: 0,
                windowWidth: 1080
            },
            jsPDF: { unit: 'px', format: [1080, 1080], orientation: 'portrait' },
            pagebreak: { mode: 'css', before: '.slide-preview' }
        };

        await html2pdf().set(opt).from(worker).save();
    } catch (e) {
        console.error("Error crítico en PDF:", e);
    } finally {
        document.body.removeChild(worker);
        btn.textContent = "Descargar PDF para LinkedIn";
        btn.disabled = false;
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
