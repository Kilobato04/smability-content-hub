/* ============================================================
   SMABILITY CONTENT HUB — app.js
   ============================================================ */

let masterPlan = null;
let currentSelectedMonth = 3;

// ─── 1. INIT ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    init();
    document.getElementById('month-selector').addEventListener('change', e => {
        currentSelectedMonth = parseInt(e.target.value);
        renderCalendar();
    });
    document.getElementById('generate-btn').addEventListener('click', generateContent);
    document.getElementById('download-pdf-btn').addEventListener('click', downloadCarouselPDF);
    document.querySelectorAll('.action-buttons button').forEach(b => {
        if (b.textContent.trim() === 'Editar') b.addEventListener('click', toggleEdit);
    });
});

async function init() {
    try {
        const res = await fetch('data/master_abril.json');
        masterPlan = await res.json();
        populateSelector();
        renderCalendar();
    } catch (e) {
        console.error('Error cargando Plan Maestro:', e);
        document.getElementById('post-selector').innerHTML = '<option value="">Error al cargar</option>';
    }
}

// ─── 2. CALENDARIO ──────────────────────────────────────────
function renderCalendar() {
    const cal = document.getElementById('calendar-grid');
    if (!cal || !masterPlan) return;
    const year = 2026;
    cal.innerHTML = '';

    ['L','M','X','J','V','S','D'].forEach(d => {
        const wd = document.createElement('div');
        wd.className = 'cal-day empty';
        wd.style.cssText = 'font-size:.6rem;font-weight:700;letter-spacing:.08em;color:#555;background:transparent;cursor:default;';
        wd.textContent = d;
        cal.appendChild(wd);
    });

    const startOffset = (new Date(year, currentSelectedMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, currentSelectedMonth + 1, 0).getDate();
    const today = new Date();

    for (let x = 0; x < startOffset; x++) {
        const e = document.createElement('div');
        e.className = 'cal-day empty';
        cal.appendChild(e);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dow = new Date(year, currentSelectedMonth, i).getDay();
        const day = document.createElement('div');
        day.className = 'cal-day';
        day.textContent = i;

        if (dow === 0 || dow === 6) {
            day.classList.add('weekend');
        } else {
            const hasPost = masterPlan.pipeline.some(p => {
                const d = new Date(p.fecha + 'T00:00:00');
                return d.getMonth() === currentSelectedMonth && d.getDate() === i;
            });
            if (hasPost) day.classList.add('has-content');

            const key = `pub_${year}_${currentSelectedMonth}_${i}`;
            if (localStorage.getItem(key)) day.classList.add('published');
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

        if (i === today.getDate() && currentSelectedMonth === today.getMonth() && year === today.getFullYear())
            day.classList.add('today');

        cal.appendChild(day);
    }
}

// ─── 3. SELECTOR ────────────────────────────────────────────
function populateSelector() {
    const sel = document.getElementById('post-selector');
    sel.innerHTML = '<option value="">Selecciona un post...</option>';
    masterPlan.pipeline.forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        const f = p.fecha.split('-').reverse().slice(0,2).join('/');
        o.textContent = `${f} · ${p.cat} · ${p.slides[0].headline.substring(0,38)}`;
        sel.appendChild(o);
    });
}

// ─── 4. GENERACIÓN ──────────────────────────────────────────
async function generateContent() {
    const postId = document.getElementById('post-selector').value;
    if (!postId) return alert('Selecciona un post del plan.');

    const postData  = masterPlan.pipeline.find(p => p.id === postId);
    const postOutput = document.getElementById('linkedin-post-output');
    const container  = document.getElementById('carousel-preview-container');
    const genBtn     = document.getElementById('generate-btn');

    postOutput.value = '';
    container.innerHTML = '<div class="carousel-placeholder">Generando con IA…</div>';
    genBtn.disabled = true;
    genBtn.textContent = 'Generando…';

    try {
        const res = await fetch('/api/generate-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                technical_data: postData.datos,
                category: postData.cat,
                model: 'gpt-4o',
                temperature: 0.5
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        postOutput.value = data.linkedin_post;
        renderCarouselPreview(postData);
        document.getElementById('download-pdf-btn').disabled = false;
    } catch (err) {
        postOutput.value = `Error: ${err.message}`;
        container.innerHTML = '<div class="carousel-placeholder">Error al generar.</div>';
        console.error(err);
    } finally {
        genBtn.disabled = false;
        genBtn.textContent = '⚡ Generar Post e Imágenes';
    }
}

// ─── 5. UTILIDAD: imagen → base64 ───────────────────────────
// html2canvas no puede leer rutas relativas desde nodos fuera del
// flujo normal. Pre-convertimos cada imagen a data URL.
function imgToBase64(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width  = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            resolve(c.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => resolve(null);
        img.src = src + '?v=' + Date.now();
    });
}

// ─── 6. BUILD SLIDE ─────────────────────────────────────────
// Único constructor para pantalla Y PDF.
// sidepx = undefined  →  modo preview (usa clases CSS + rem)
// sidepx = 1080       →  modo PDF     (todo inline proporcional)
// bgBase64            →  data URL de la imagen de fondo (solo PDF)
function buildSlideEl(slide, index, total, sidepx, bgBase64) {
    const pdf  = !!sidepx;
    const S    = sidepx || 0;

    const el = document.createElement('div');
    el.className = `slide-preview slide-${slide.type}`;

    // ── Fondo ────────────────────────────────────────────────
    const bgUrl = pdf ? bgBase64 : (slide.bg || null);
    if (bgUrl) {
        el.style.backgroundImage    = `url(${bgUrl})`;
        el.style.backgroundSize     = 'cover';
        el.style.backgroundPosition = 'center';
    }

    // ── Estilos base del contenedor (solo PDF) ───────────────
    if (pdf) {
        const bgColor = slide.type === 'cta_clean'
            ? '' // lo ponemos en background shorthand abajo
            : '#0D0D0D';

        el.style.cssText = `
            background-image:${bgUrl ? `url(${bgUrl})` : 'none'};
            background-size:cover;
            background-position:center;
            background-color:${bgColor};
            width:${S}px;
            height:${S}px;
            aspect-ratio:unset;
            position:relative;
            display:flex;
            flex-direction:column;
            justify-content:space-between;
            padding:${Math.round(S * 0.052)}px;
            overflow:hidden;
            box-sizing:border-box;
            border-radius:0;
            box-shadow:none;
        `;
        if (slide.type === 'cta_clean')
            el.style.background = 'linear-gradient(145deg,#020f2a 0%,#001a5c 60%,#0a0a0a 100%)';
    }

    // ── Escala proporcional a S ──────────────────────────────
    const pad       = pdf ? Math.round(S * 0.052) : 56;
    const fs_h3     = pdf ? Math.round(S * 0.072) : 48;   // px
    const fs_metric = pdf ? Math.round(S * 0.115) : 76;
    const fs_p      = pdf ? Math.round(S * 0.024) : 16;
    const fs_num    = pdf ? Math.round(S * 0.017) : 11;
    const fs_ftr    = pdf ? Math.round(S * 0.017) : 11;
    const fs_arrow  = pdf ? Math.round(S * 0.042) : 29;
    const dot_sz    = pdf ? Math.round(S * 0.009) : 7;
    const gap_sm    = pdf ? Math.round(S * 0.011) : 12;
    const fp        = pdf ? Math.round(S * 0.026) : 28;   // frame padding
    const fc        = pdf ? Math.round(S * 0.033) : 36;   // frame corner

    // ── Overlay cover_bold ───────────────────────────────────
    const overlayDiv = slide.type === 'cover_bold'
        ? `<div style="position:absolute;inset:0;
               background:linear-gradient(160deg,
                   rgba(0,0,0,0.88) 0%,
                   rgba(0,71,171,0.75) 50%,
                   rgba(0,0,0,0.95) 100%);
               z-index:1;pointer-events:none;"></div>`
        : '';

    // ── Marco neon data_callout ──────────────────────────────
    const bw = pdf ? 4 : 3;
    const frameDiv = slide.type === 'data_callout'
        ? `<div style="position:absolute;top:${fp}px;left:${fp}px;right:${fp}px;bottom:${fp}px;
               border:${pdf?2:1.5}px solid rgba(57,255,20,0.25);border-radius:8px;
               z-index:1;pointer-events:none;"></div>
           <div style="position:absolute;top:${fp}px;left:${fp}px;
               width:${fc}px;height:${fc}px;
               border-top:${bw}px solid #39FF14;border-left:${bw}px solid #39FF14;
               border-radius:8px 0 0 0;z-index:2;pointer-events:none;"></div>
           <div style="position:absolute;bottom:${fp}px;right:${fp}px;
               width:${fc}px;height:${fc}px;
               border-bottom:${bw}px solid #39FF14;border-right:${bw}px solid #39FF14;
               border-radius:0 0 8px 0;z-index:2;pointer-events:none;"></div>`
        : '';

    // ── Número de lámina ─────────────────────────────────────
    const numTop  = pdf ? Math.round(S * 0.045) : 48;
    const numLeft = pdf ? Math.round(S * 0.022) : 24;
    const numLabel = `
        <span style="
            position:absolute;top:${numTop}px;left:${numLeft}px;
            font-family:'Space Grotesk',sans-serif;
            font-size:${fs_num}px;font-weight:700;
            letter-spacing:.15em;text-transform:uppercase;
            color:#555555;z-index:10;
            background:rgba(0,0,0,0.5);
            padding:${Math.round(S*0.003||3)}px ${Math.round(S*0.008||8)}px;
            border-radius:4px;">
            0${index+1} / 0${total}
        </span>`;

    // ── Flecha — siempre verde neon, siempre inline ──────────
    const isLast = index === total - 1;
    const arrow = isLast ? '' : `
        <div style="
            position:absolute;top:${pad}px;right:${pad}px;
            font-size:${fs_arrow}px;line-height:1;
            color:#39FF14;z-index:10;user-select:none;">→</div>`;

    // ── Métrica ──────────────────────────────────────────────
    const metricHTML = slide.metric ? `
        <div style="
            font-family:'Space Grotesk',sans-serif;
            font-size:${fs_metric}px;font-weight:900;line-height:1;
            color:#39FF14;letter-spacing:-.04em;
            margin:${gap_sm}px 0;">
            ${slide.metric}
        </div>` : '';

    // ── Texto de apoyo ───────────────────────────────────────
    const supportHTML = slide.supporting_text ? `
        <p style="
            font-family:'Inter',sans-serif;
            font-size:${fs_p}px;
            color:#9A9A9A;line-height:1.6;margin:0;">
            ${slide.supporting_text}
        </p>` : '';

    // ── Titular ──────────────────────────────────────────────
    const h3HTML = `
        <h3 style="
            font-family:'Space Grotesk',sans-serif;
            font-size:${fs_h3}px;font-weight:900;line-height:1.0;
            letter-spacing:-.02em;text-transform:uppercase;
            color:#ffffff;margin:0 0 ${gap_sm}px;">
            ${slide.headline}
        </h3>`;

    // ── Footer ───────────────────────────────────────────────
    const footer = `
        <div style="
            display:flex;align-items:center;
            font-family:'Space Grotesk',sans-serif;
            font-size:${fs_ftr}px;font-weight:700;
            letter-spacing:.12em;text-transform:uppercase;
            color:#555555;
            border-top:1px solid rgba(255,255,255,0.08);
            padding-top:${Math.round(S*0.013||14)}px;
            margin-top:auto;position:relative;z-index:2;">
            <span style="
                width:${dot_sz}px;height:${dot_sz}px;border-radius:50%;
                background:#39FF14;display:inline-block;
                margin-right:${Math.round(S*0.007||8)}px;flex-shrink:0;">
            </span>smability.io
        </div>`;

    // ── Body padding superior (clearance del número de lámina) ─
    const bodyPadTop = pdf ? Math.round(S * 0.074) : 80;

    el.innerHTML = `
        ${overlayDiv}
        ${frameDiv}
        ${numLabel}
        ${arrow}
        <div style="
            position:relative;z-index:2;
            width:100%;height:100%;
            display:flex;flex-direction:column;
            justify-content:space-between;">
            <div style="
                flex:1;display:flex;flex-direction:column;
                justify-content:flex-end;
                padding-top:${bodyPadTop}px;">
                ${h3HTML}
                ${metricHTML}
                ${supportHTML}
            </div>
            ${footer}
        </div>`;

    return el;
}

// ─── 7. RENDER PREVIEW ──────────────────────────────────────
function renderCarouselPreview(postData) {
    const container = document.getElementById('carousel-preview-container');
    container.innerHTML = '';
    const total = postData.slides.length;
    postData.slides.forEach((slide, i) => {
        // Sin sidepx ni bgBase64 → modo preview pantalla
        container.appendChild(buildSlideEl(slide, i, total));
    });
}

// ─── 8. DESCARGA PDF ────────────────────────────────────────
async function downloadCarouselPDF() {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        alert('Librerías no cargadas. Recarga la página.');
        return;
    }
    const postId = document.getElementById('post-selector').value;
    if (!postId) return alert('Genera el contenido primero.');

    const postData = masterPlan.pipeline.find(p => p.id === postId);
    const btn = document.getElementById('download-pdf-btn');
    btn.disabled = true;

    const SIDE = 1080;

    // Stage visible fuera del viewport (position:fixed, izquierda negativa).
    // NO usamos visibility:hidden — html2canvas necesita que el nodo sea pintable.
    const stage = document.createElement('div');
    stage.style.cssText = [
        'position:fixed',
        'top:0',
        `left:-${SIDE + 100}px`,
        `width:${SIDE}px`,
        `height:${SIDE}px`,
        'overflow:hidden',
        'z-index:99999',
        'pointer-events:none',
    ].join(';');
    document.body.appendChild(stage);

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [SIDE, SIDE],
            hotfixes: ['px_scaling'],
            compress: true
        });

        const total = postData.slides.length;

        for (let i = 0; i < total; i++) {
            btn.textContent = `Capturando ${i + 1} / ${total}…`;

            const slideData = postData.slides[i];

            // Pre-convertir imagen a base64 para que html2canvas la lea sin CORS
            let bgBase64 = null;
            if (slideData.bg) {
                bgBase64 = await imgToBase64(slideData.bg);
            }

            // Construir clon con tamaños proporcionales a 1080px + bg en base64
            const clone = buildSlideEl(slideData, i, total, SIDE, bgBase64);

            stage.innerHTML = '';
            stage.appendChild(clone);

            // Esperar 2 frames para que el browser pinte fuentes + colores
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

            const canvas = await html2canvas(clone, {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                logging: false,
                width: SIDE,
                height: SIDE,
                windowWidth: SIDE,
                windowHeight: SIDE,
                x: 0,
                y: 0,
                scrollX: 0,
                scrollY: 0,
                backgroundColor: '#0D0D0D',
                onclone: doc => {
                    const lnk = doc.createElement('link');
                    lnk.rel  = 'stylesheet';
                    lnk.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;900&family=Inter:wght@400;600&display=swap';
                    doc.head.appendChild(lnk);
                }
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            if (i > 0) pdf.addPage([SIDE, SIDE], 'portrait');
            pdf.addImage(imgData, 'JPEG', 0, 0, SIDE, SIDE, `s${i}`, 'FAST');
        }

        btn.textContent = 'Guardando…';
        pdf.save(`Smability_Carrusel_${Date.now()}.pdf`);

    } catch (e) {
        console.error('PDF error:', e);
        alert(`Error: ${e.message}`);
    } finally {
        if (document.body.contains(stage)) document.body.removeChild(stage);
        btn.textContent = '↓ Descargar PDF para LinkedIn';
        btn.disabled = false;
    }
}

// ─── 9. HELPERS ─────────────────────────────────────────────
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
        document.querySelectorAll('.action-buttons .primary').forEach(b => {
            const orig = b.textContent;
            b.textContent = '✓ Copiado';
            setTimeout(() => b.textContent = orig, 2000);
        });
    });
}
