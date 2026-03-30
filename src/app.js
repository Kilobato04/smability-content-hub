/* ============================================================
   SMABILITY CONTENT HUB — app.js
   Compatible con: index.html · master_abril.json · style.css
   ============================================================ */

let masterPlan = null;
let currentSelectedMonth = 3; // Abril por defecto

// --- 1. INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    init();

    document.getElementById('month-selector').addEventListener('change', (e) => {
        currentSelectedMonth = parseInt(e.target.value);
        renderCalendar();
    });

    document.getElementById('generate-btn').addEventListener('click', generateContent);
    document.getElementById('download-pdf-btn').addEventListener('click', downloadCarouselPDF);

    // Botón Editar — selección robusta por texto
    document.querySelectorAll('.action-buttons button').forEach(btn => {
        if (btn.textContent.trim() === 'Editar') {
            btn.addEventListener('click', toggleEdit);
        }
    });
});

async function init() {
    try {
        const res = await fetch('data/master_abril.json');
        masterPlan = await res.json();
        populateSelector();
        renderCalendar();
    } catch (e) {
        console.error('Error cargando el Plan Maestro:', e);
        document.getElementById('post-selector').innerHTML =
            '<option value="">Error al cargar el plan</option>';
    }
}

// --- 2. CALENDARIO ---
function renderCalendar() {
    const cal = document.getElementById('calendar-grid');
    if (!cal || !masterPlan) return;

    const year = 2026;
    cal.innerHTML = '';

    // Cabecera de días
    ['L','M','X','J','V','S','D'].forEach(d => {
        const wd = document.createElement('div');
        wd.className = 'cal-day empty';
        wd.style.cssText = 'font-size:.6rem;font-weight:700;letter-spacing:.08em;color:var(--g600);background:transparent;cursor:default;';
        wd.textContent = d;
        cal.appendChild(wd);
    });

    const firstDayIndex = new Date(year, currentSelectedMonth, 1).getDay();
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const daysInMonth = new Date(year, currentSelectedMonth + 1, 0).getDate();
    const today = new Date();

    for (let x = 0; x < startOffset; x++) {
        const empty = document.createElement('div');
        empty.className = 'cal-day empty';
        cal.appendChild(empty);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dateObj = new Date(year, currentSelectedMonth, i);
        const dow = dateObj.getDay();
        const day = document.createElement('div');

        day.className = 'cal-day';
        day.textContent = i;

        if (dow === 0 || dow === 6) {
            day.classList.add('weekend');
        } else {
            // ¿tiene post en el plan maestro?
            const hasPost = masterPlan.pipeline.some(p => {
                const d = new Date(p.fecha + 'T00:00:00');
                return d.getMonth() === currentSelectedMonth && d.getDate() === i;
            });
            if (hasPost) day.classList.add('has-content');

            // ¿ya publicado? (persiste en localStorage)
            const key = `pub_${year}_${currentSelectedMonth}_${i}`;
            if (localStorage.getItem(key)) day.classList.add('published');

            // Toggle publicado al hacer clic
            day.addEventListener('click', () => {
                if (localStorage.getItem(key)) {
                    localStorage.removeItem(key);
                    day.classList.remove('published');
                } else {
                    localStorage.setItem(key, 'true');
                    day.classList.add('published');
                }
            });
        }

        // Hoy
        if (i === today.getDate() &&
            currentSelectedMonth === today.getMonth() &&
            year === today.getFullYear()) {
            day.classList.add('today');
        }

        cal.appendChild(day);
    }
}

// --- 3. SELECTOR DE POSTS ---
function populateSelector() {
    const selector = document.getElementById('post-selector');
    selector.innerHTML = '<option value="">Selecciona un post...</option>';
    masterPlan.pipeline.forEach(post => {
        const opt = document.createElement('option');
        opt.value = post.id;
        // Fecha legible + categoría + título del primer slide
        const fecha = post.fecha.split('-').reverse().slice(0,2).join('/');
        opt.textContent = `${fecha} · ${post.cat} · ${post.slides[0].headline.substring(0,40)}`;
        selector.appendChild(opt);
    });
}

// --- 4. GENERACIÓN ---
async function generateContent() {
    const postId = document.getElementById('post-selector').value;
    if (!postId) return alert('Selecciona un post del plan.');

    const postData = masterPlan.pipeline.find(p => p.id === postId);
    const postOutput = document.getElementById('linkedin-post-output');
    const container = document.getElementById('carousel-preview-container');
    const genBtn = document.getElementById('generate-btn');

    postOutput.value = '';
    container.innerHTML = '<div class="carousel-placeholder">Generando con IA…</div>';
    genBtn.disabled = true;
    genBtn.textContent = 'Generando…';

    try {
        const response = await fetch('/api/generate-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                technical_data: postData.datos,
                category: postData.cat,
                model: 'gpt-4o',
                temperature: 0.5
            })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        postOutput.value = data.linkedin_post;
        renderCarouselPreview(postData);
        document.getElementById('download-pdf-btn').disabled = false;

    } catch (error) {
        postOutput.value = `Error: ${error.message}`;
        container.innerHTML = '<div class="carousel-placeholder">Error al generar. Revisa la consola.</div>';
        console.error(error);
    } finally {
        genBtn.disabled = false;
        genBtn.textContent = 'Generar Post e Imágenes';
    }
}

// --- 5. RENDER DEL CARRUSEL ---
function renderCarouselPreview(postData) {
    const container = document.getElementById('carousel-preview-container');
    container.innerHTML = '';

    const total = postData.slides.length;

    postData.slides.forEach((slide, index) => {
        const el = document.createElement('div');
        el.className = `slide-preview slide-${slide.type}`;

        // Imagen de fondo si existe
        if (slide.bg) {
            el.style.backgroundImage = `url(${slide.bg})`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
        }

        const isLastSlide = index === total - 1;
        const arrow = isLastSlide ? '' : '<div class="slide-nav-arrow">→</div>';

        // Overlay para cover con imagen
        const overlay = (slide.type === 'cover_bold' && slide.bg)
            ? '<div class="cover-overlay"></div>'
            : '';

        // Número de lámina
        const numLabel = `<span class="slide-num">0${index + 1} / 0${total}</span>`;

        // Métrica
        const metricHTML = slide.metric
            ? `<div class="slide-metric">${slide.metric}</div>`
            : '';

        // Texto de apoyo
        const supportHTML = slide.supporting_text
            ? `<p>${slide.supporting_text}</p>`
            : '';

        // Footer unificado: dot + smability.io
        const footer = `
            <div class="slide-footer">
                <span class="dot"></span>smability.io
            </div>`;

        el.innerHTML = `
            ${overlay}
            ${numLabel}
            ${arrow}
            <div class="slide-content-wrapper">
                <div class="slide-body">
                    <h3>${slide.headline}</h3>
                    ${metricHTML}
                    ${supportHTML}
                </div>
                ${footer}
            </div>`;

        container.appendChild(el);
    });
}

// --- 6. DESCARGA PDF ---
async function downloadCarouselPDF() {
    const container = document.getElementById('carousel-preview-container');
    const slides = container.querySelectorAll('.slide-preview');
    if (!slides.length) return alert('Genera el contenido primero.');

    const btn = document.getElementById('download-pdf-btn');
    btn.textContent = 'Preparando PDF…';
    btn.disabled = true;

    const opt = {
        margin: 0,
        filename: `Smability_LinkedIn_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollY: -window.scrollY,
            windowWidth: 1080,
            windowHeight: 1080
        },
        jsPDF: {
            unit: 'px',
            format: [1080, 1080],
            orientation: 'portrait',
            compress: true
        }
    };

    try {
        let worker = html2pdf().set(opt).from(slides[0]).toPdf();
        for (let i = 1; i < slides.length; i++) {
            worker = worker
                .get('pdf').then(pdf => pdf.addPage())
                .from(slides[i]).toContainer().toCanvas().toPdf();
        }
        await worker.save();
    } catch (e) {
        console.error('Error generando PDF:', e);
        alert('Error al generar el PDF. Revisa la consola.');
    } finally {
        btn.textContent = 'Descargar PDF para LinkedIn';
        btn.disabled = false;
    }
}

// --- 7. HELPERS ---
function toggleEdit() {
    const area = document.getElementById('linkedin-post-output');
    area.readOnly = !area.readOnly;
    area.style.backgroundColor = area.readOnly ? '' : 'rgba(255,255,255,0.04)';
    this.textContent = area.readOnly ? 'Editar' : 'Guardar';
}

function copyText() {
    const text = document.getElementById('linkedin-post-output').value;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        const btns = document.querySelectorAll('.action-buttons .primary');
        btns.forEach(b => {
            const orig = b.textContent;
            b.textContent = '✓ Copiado';
            setTimeout(() => b.textContent = orig, 2000);
        });
    });
}
