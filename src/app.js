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
        const e = document.createElement('div'); e.className = 'cal-day empty'; cal.appendChild(e);
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
                    localStorage.removeItem(key); day.classList.remove('published');
                } else {
                    localStorage.setItem(key, 'true'); day.classList.add('published');
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

    const postData   = masterPlan.pipeline.find(p => p.id === postId);
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
                slides: postData.slides.map(s => ({ type: s.type, headline: s.headline, metric: s.metric || null })),
                model: 'gpt-4o',
                temperature: 0.6
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // El API ahora devuelve: { linkedin_post, slide_messages: [...] }
        postOutput.value = data.linkedin_post;

        // Enriquecer slides con mensajes generados por IA
        const enriched = enrichSlides(postData, data.slide_messages || []);
        renderCarouselPreview(enriched);
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

// ─── 5. ENRIQUECER SLIDES CON MENSAJES IA ───────────────────
// Fusiona los mensajes generados por el LLM con la estructura del JSON
function enrichSlides(postData, slideMessages) {
    return {
        ...postData,
        slides: postData.slides.map((slide, i) => {
            const msg = slideMessages[i] || {};
            return {
                ...slide,
                // El LLM puede sobreescribir o añadir estos campos
                ai_hook:      msg.hook      || null,  // gancho superior (cover)
                ai_body:      msg.body      || null,  // párrafo de desarrollo
                ai_stat_ctx:  msg.stat_ctx  || null,  // contexto bajo la métrica
                ai_cta_label: msg.cta_label || null,  // texto del botón CTA
                cat_tag:      postData.cat             // pill de categoría
            };
        })
    };
}

// ─── 6. UTILIDAD: imagen → base64 ───────────────────────────
function imgToBase64(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            resolve(c.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => resolve(null);
        img.src = src + '?v=' + Date.now();
    });
}

// ─── 7. BUILD SLIDE ─────────────────────────────────────────
function buildSlideEl(slide, index, total, sidepx, bgBase64) {
    const isPDF = !!sidepx;
    const S     = sidepx || 0;

    const el = document.createElement('div');
    el.className = `slide-preview slide-${slide.type}`;

    // Fondo
    const bgUrl = isPDF ? bgBase64 : (slide.bg || null);
    if (bgUrl) {
        el.style.backgroundImage    = `url(${bgUrl})`;
        el.style.backgroundSize     = 'cover';
        el.style.backgroundPosition = 'center';
    }

    if (isPDF) {
        el.style.cssText = `
            background-image:${bgUrl ? `url(${bgUrl})` : 'none'};
            background-size:cover;background-position:center;
            background-color:#0D0D0D;
            width:${S}px;height:${S}px;aspect-ratio:unset;
            position:relative;display:flex;flex-direction:column;
            justify-content:space-between;
            padding:${Math.round(S*0.052)}px;
            overflow:hidden;box-sizing:border-box;
            border-radius:0;box-shadow:none;`;
        if (slide.type === 'cta_clean')
            el.style.background = 'linear-gradient(145deg,#020f2a 0%,#001a5c 60%,#0a0a0a 100%)';
    }

    // Escala proporcional
    const pad      = isPDF ? Math.round(S*0.052) : 56;
    const fs_tag   = isPDF ? Math.round(S*0.018) : 12;
    const fs_h3    = isPDF ? Math.round(S*0.068) : 44;
    const fs_hook  = isPDF ? Math.round(S*0.026) : 17;
    const fs_body  = isPDF ? Math.round(S*0.022) : 14;
    const fs_met   = isPDF ? Math.round(S*0.110) : 72;
    const fs_ctx   = isPDF ? Math.round(S*0.022) : 14;
    const fs_num   = isPDF ? Math.round(S*0.016) : 11;
    const fs_ftr   = isPDF ? Math.round(S*0.016) : 11;
    const fs_arrow = isPDF ? Math.round(S*0.040) : 26;
    const dot_sz   = isPDF ? Math.round(S*0.009) : 7;
    const gap      = isPDF ? Math.round(S*0.014) : 14;
    const fp       = isPDF ? Math.round(S*0.026) : 28;
    const fc       = isPDF ? Math.round(S*0.033) : 36;

    // ── Pill de categoría (viral: da contexto inmediato) ─────
    const catTag = slide.cat_tag ? `
        <div style="
            display:inline-block;
            background:rgba(57,255,20,0.12);
            border:1px solid #39FF14;
            color:#39FF14;
            font-family:'Space Grotesk',sans-serif;
            font-size:${fs_tag}px;font-weight:700;
            letter-spacing:.12em;text-transform:uppercase;
            padding:${isPDF?Math.round(S*.005):4}px ${isPDF?Math.round(S*.012):10}px;
            border-radius:4px;margin-bottom:${gap}px;">
            ${slide.cat_tag}
        </div>` : '';

    // ── Overlay cover ────────────────────────────────────────
    const overlayDiv = slide.type === 'cover_bold' ? `
        <div style="position:absolute;inset:0;
            background:linear-gradient(160deg,
                rgba(0,0,0,0.88) 0%,rgba(0,71,171,0.75) 50%,rgba(0,0,0,0.95) 100%);
            z-index:1;pointer-events:none;"></div>` : '';

    // ── Marco neon data_callout ──────────────────────────────
    const bw = isPDF ? 4 : 3;
    const frameDiv = slide.type === 'data_callout' ? `
        <div style="position:absolute;top:${fp}px;left:${fp}px;right:${fp}px;bottom:${fp}px;
            border:${isPDF?2:1.5}px solid rgba(57,255,20,0.25);border-radius:8px;
            z-index:1;pointer-events:none;"></div>
        <div style="position:absolute;top:${fp}px;left:${fp}px;
            width:${fc}px;height:${fc}px;
            border-top:${bw}px solid #39FF14;border-left:${bw}px solid #39FF14;
            border-radius:8px 0 0 0;z-index:2;pointer-events:none;"></div>
        <div style="position:absolute;bottom:${fp}px;right:${fp}px;
            width:${fc}px;height:${fc}px;
            border-bottom:${bw}px solid #39FF14;border-right:${bw}px solid #39FF14;
            border-radius:0 0 8px 0;z-index:2;pointer-events:none;"></div>` : '';

    // ── Número de lámina ─────────────────────────────────────
    const numTop  = isPDF ? Math.round(S*0.045) : 48;
    const numLeft = isPDF ? Math.round(S*0.022) : 24;
    const numLabel = `
        <span style="
            position:absolute;top:${numTop}px;left:${numLeft}px;
            font-family:'Space Grotesk',sans-serif;
            font-size:${fs_num}px;font-weight:700;
            letter-spacing:.15em;text-transform:uppercase;
            color:#555;z-index:10;background:rgba(0,0,0,0.5);
            padding:${isPDF?Math.round(S*.003):3}px ${isPDF?Math.round(S*.008):8}px;
            border-radius:4px;">
            0${index+1} / 0${total}
        </span>`;

    // ── Flecha verde neon ────────────────────────────────────
    const isLast = index === total - 1;
    const arrow = isLast ? '' : `
        <div style="
            position:absolute;top:${pad}px;right:${pad}px;
            font-size:${fs_arrow}px;line-height:1;
            color:#39FF14;z-index:10;user-select:none;">→</div>`;

    // ── Contenido según tipo de slide ────────────────────────
    let bodyContent = '';

    if (slide.type === 'cover_bold') {
        // Hook de IA arriba del titular (gancho tipo revista)
        const hookLine = slide.ai_hook ? `
            <p style="
                font-family:'Inter',sans-serif;
                font-size:${fs_hook}px;font-weight:600;
                color:#9A9A9A;line-height:1.4;
                margin:0 0 ${gap}px;
                border-left:3px solid #39FF14;
                padding-left:${isPDF?Math.round(S*.014):12}px;">
                ${slide.ai_hook}
            </p>` : '';

        bodyContent = `
            ${catTag}
            <h3 style="
                font-family:'Space Grotesk',sans-serif;
                font-size:${fs_h3}px;font-weight:900;line-height:1.0;
                letter-spacing:-.02em;text-transform:uppercase;
                color:#fff;margin:0 0 ${gap}px;">
                ${slide.headline}
            </h3>
            ${hookLine}`;

    } else if (slide.type === 'data_callout') {
        // Métrica central + contexto IA abajo
        const ctxLine = (slide.ai_stat_ctx || slide.supporting_text) ? `
            <p style="
                font-family:'Inter',sans-serif;
                font-size:${fs_ctx}px;color:#9A9A9A;
                line-height:1.5;margin:${gap}px 0 0;
                max-width:75%;margin-left:auto;margin-right:auto;">
                ${slide.ai_stat_ctx || slide.supporting_text}
            </p>` : '';

        bodyContent = `
            <p style="
                font-family:'Space Grotesk',sans-serif;
                font-size:${isPDF?Math.round(S*.028):18}px;font-weight:700;
                color:#fff;margin:0 0 ${gap}px;text-align:center;">
                ${slide.headline}
            </p>
            <div style="
                font-family:'Space Grotesk',sans-serif;
                font-size:${fs_met}px;font-weight:900;line-height:1;
                color:#39FF14;letter-spacing:-.04em;text-align:center;">
                ${slide.metric || ''}
            </div>
            ${ctxLine}`;

    } else if (slide.type === 'cta_clean') {
        // CTA con label generado por IA
        const ctaLabel = slide.ai_cta_label || slide.supporting_text || 'Agenda una demo';
        const subBody  = slide.ai_body || '';

        bodyContent = `
            <h3 style="
                font-family:'Space Grotesk',sans-serif;
                font-size:${fs_h3}px;font-weight:900;line-height:1.0;
                letter-spacing:-.02em;text-transform:uppercase;
                color:#fff;margin:0 0 ${gap}px;">
                ${slide.headline}
            </h3>
            ${subBody ? `<p style="font-family:'Inter',sans-serif;font-size:${fs_body}px;color:#9A9A9A;line-height:1.6;margin:0 0 ${gap*1.5}px;">${subBody}</p>` : ''}
            <div style="
                display:inline-flex;align-items:center;gap:10px;
                border:2px solid #39FF14;border-radius:6px;
                padding:${isPDF?Math.round(S*.013):14}px ${isPDF?Math.round(S*.026):28}px;
                font-family:'Space Grotesk',sans-serif;
                font-size:${isPDF?Math.round(S*.020):13}px;
                font-weight:700;letter-spacing:.1em;text-transform:uppercase;
                color:#39FF14;">
                ↗ ${ctaLabel}
            </div>`;

    } else {
        // split_map u otros — headline + body IA
        const bodyText = slide.ai_body || slide.supporting_text || '';
        bodyContent = `
            ${catTag}
            <h3 style="
                font-family:'Space Grotesk',sans-serif;
                font-size:${fs_h3}px;font-weight:900;line-height:1.0;
                letter-spacing:-.02em;text-transform:uppercase;
                color:#fff;margin:0 0 ${gap}px;">
                ${slide.headline}
            </h3>
            ${bodyText ? `
            <p style="
                font-family:'Inter',sans-serif;
                font-size:${fs_body}px;color:#9A9A9A;
                line-height:1.65;margin:0;
                border-left:2px solid rgba(57,255,20,0.4);
                padding-left:${isPDF?Math.round(S*.014):12}px;">
                ${bodyText}
            </p>` : ''}`;
    }

    // ── Footer ───────────────────────────────────────────────
    const footer = `
        <div style="
            display:flex;align-items:center;
            font-family:'Space Grotesk',sans-serif;
            font-size:${fs_ftr}px;font-weight:700;
            letter-spacing:.12em;text-transform:uppercase;
            color:#555;border-top:1px solid rgba(255,255,255,0.08);
            padding-top:${isPDF?Math.round(S*.013):14}px;
            margin-top:auto;position:relative;z-index:2;">
            <span style="
                width:${dot_sz}px;height:${dot_sz}px;border-radius:50%;
                background:#39FF14;display:inline-block;
                margin-right:${isPDF?Math.round(S*.007):8}px;flex-shrink:0;">
            </span>smability.io
        </div>`;

    const bodyPadTop = isPDF ? Math.round(S*0.074) : 80;

    // Para data_callout centramos verticalmente
    const wrapJustify = slide.type === 'data_callout' ? 'center' : 'space-between';
    const wrapAlign   = slide.type === 'data_callout' ? 'center' : 'stretch';

    el.innerHTML = `
        ${overlayDiv}
        ${frameDiv}
        ${numLabel}
        ${arrow}
        <div style="
            position:relative;z-index:2;
            width:100%;height:100%;
            display:flex;flex-direction:column;
            justify-content:${wrapJustify};
            align-items:${wrapAlign};
            text-align:${slide.type === 'data_callout' ? 'center' : 'left'};">
            <div style="
                flex:${slide.type === 'data_callout' ? '0' : '1'};
                display:flex;flex-direction:column;
                justify-content:${slide.type === 'data_callout' ? 'center' : 'flex-end'};
                padding-top:${slide.type === 'data_callout' ? 0 : bodyPadTop}px;">
                ${bodyContent}
            </div>
            ${slide.type === 'data_callout' ? '' : footer}
        </div>
        ${slide.type === 'data_callout' ? `
        <div style="
            position:absolute;bottom:${pad}px;left:${pad}px;right:${pad}px;
            display:flex;align-items:center;z-index:2;
            font-family:'Space Grotesk',sans-serif;
            font-size:${fs_ftr}px;font-weight:700;
            letter-spacing:.12em;text-transform:uppercase;
            color:#555;border-top:1px solid rgba(255,255,255,0.08);
            padding-top:${isPDF?Math.round(S*.013):14}px;">
            <span style="width:${dot_sz}px;height:${dot_sz}px;border-radius:50%;
                background:#39FF14;display:inline-block;
                margin-right:${isPDF?Math.round(S*.007):8}px;flex-shrink:0;"></span>smability.io
        </div>` : ''}`;

    return el;
}

// ─── 8. RENDER PREVIEW ──────────────────────────────────────
function renderCarouselPreview(postData) {
    const container = document.getElementById('carousel-preview-container');
    container.innerHTML = '';
    const total = postData.slides.length;
    postData.slides.forEach((slide, i) => {
        container.appendChild(buildSlideEl(slide, i, total));
    });
}

// ─── 9. DESCARGA PDF ────────────────────────────────────────
async function downloadCarouselPDF() {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        alert('Librerías no cargadas. Recarga la página.');
        return;
    }
    const postId = document.getElementById('post-selector').value;
    if (!postId) return alert('Genera el contenido primero.');

    const container = document.getElementById('carousel-preview-container');
    const rendered  = container.querySelectorAll('.slide-preview');
    if (!rendered.length) return alert('Genera el contenido primero.');

    // Reconstruimos los slides enriquecidos desde el DOM actual
    // guardando el postData enriquecido en una variable de módulo
    const postData = _lastEnrichedPost;
    if (!postData) return alert('Genera el contenido primero.');

    const btn = document.getElementById('download-pdf-btn');
    btn.disabled = true;
    const SIDE = 1080;

    const stage = document.createElement('div');
    stage.style.cssText = [
        'position:fixed','top:0',`left:-${SIDE+100}px`,
        `width:${SIDE}px`,`height:${SIDE}px`,
        'overflow:hidden','z-index:99999','pointer-events:none'
    ].join(';');
    document.body.appendChild(stage);

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation:'portrait', unit:'px',
            format:[SIDE,SIDE], hotfixes:['px_scaling'], compress:true
        });

        const total = postData.slides.length;

        for (let i = 0; i < total; i++) {
            btn.textContent = `Capturando ${i+1} / ${total}…`;
            const slideData = postData.slides[i];

            let bgBase64 = null;
            if (slideData.bg) bgBase64 = await imgToBase64(slideData.bg);

            const clone = buildSlideEl(slideData, i, total, SIDE, bgBase64);
            stage.innerHTML = '';
            stage.appendChild(clone);

            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

            const canvas = await html2canvas(clone, {
                scale:2, useCORS:true, allowTaint:false, logging:false,
                width:SIDE, height:SIDE, windowWidth:SIDE, windowHeight:SIDE,
                x:0, y:0, scrollX:0, scrollY:0,
                backgroundColor:'#0D0D0D',
                onclone: doc => {
                    const lnk = doc.createElement('link');
                    lnk.rel  = 'stylesheet';
                    lnk.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;900&family=Inter:wght@400;600&display=swap';
                    doc.head.appendChild(lnk);
                }
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            if (i > 0) pdf.addPage([SIDE,SIDE],'portrait');
            pdf.addImage(imgData,'JPEG',0,0,SIDE,SIDE,`s${i}`,'FAST');
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

// Variable de módulo para pasar el post enriquecido al PDF
let _lastEnrichedPost = null;

// Sobreescribir renderCarouselPreview para guardar referencia
const _origRender = renderCarouselPreview;
// (ya referenciada arriba, la guardamos al final del init)

// ─── 10. HELPERS ────────────────────────────────────────────
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

// Parche limpio: guardar post enriquecido antes de renderizar
function renderCarouselPreview(postData) {
    _lastEnrichedPost = postData;
    const container = document.getElementById('carousel-preview-container');
    container.innerHTML = '';
    const total = postData.slides.length;
    postData.slides.forEach((slide, i) => {
        container.appendChild(buildSlideEl(slide, i, total));
    });
}
