/* ============================================================
   SMABILITY CONTENT HUB — app.js  DEFINITIVO
   ============================================================ */

let masterPlan = null;
let currentSelectedMonth = 3;

// ─── 1. INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    init();
    document.getElementById('month-selector').addEventListener('change', e => {
        currentSelectedMonth = parseInt(e.target.value);
        renderCalendar();
    });
    document.getElementById('generate-btn').addEventListener('click', generateContent);
    document.getElementById('download-pdf-btn').addEventListener('click', downloadCarouselPDF);
    document.querySelectorAll('.action-buttons button').forEach(btn => {
        if (btn.textContent.trim() === 'Editar') btn.addEventListener('click', toggleEdit);
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

// ─── 2. CALENDARIO ───────────────────────────────────────────
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
            if (masterPlan.pipeline.some(p => {
                const d = new Date(p.fecha + 'T00:00:00');
                return d.getMonth() === currentSelectedMonth && d.getDate() === i;
            })) day.classList.add('has-content');
            const key = `pub_${year}_${currentSelectedMonth}_${i}`;
            if (localStorage.getItem(key)) day.classList.add('published');
            day.addEventListener('click', () => {
                if (localStorage.getItem(key)) { localStorage.removeItem(key); day.classList.remove('published'); }
                else { localStorage.setItem(key, 'true'); day.classList.add('published'); }
            });
        }
        if (i === today.getDate() && currentSelectedMonth === today.getMonth() && year === today.getFullYear())
            day.classList.add('today');
        cal.appendChild(day);
    }
}

// ─── 3. SELECTOR ─────────────────────────────────────────────
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

// ─── 4. GENERACIÓN ───────────────────────────────────────────
async function generateContent() {
    const postId = document.getElementById('post-selector').value;
    if (!postId) return alert('Selecciona un post del plan.');
    const postData = masterPlan.pipeline.find(p => p.id === postId);
    const postOutput = document.getElementById('linkedin-post-output');
    const container  = document.getElementById('carousel-preview-container');
    const genBtn     = document.getElementById('generate-btn');

    postOutput.value = '';
    container.innerHTML = '<div class="carousel-placeholder">Generando con IA…</div>';
    genBtn.disabled = true;
    genBtn.textContent = 'Generando…';

    try {
        const res  = await fetch('/api/generate-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ technical_data: postData.datos, category: postData.cat, model: 'gpt-4o', temperature: 0.5 })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        postOutput.value = data.linkedin_post;
        renderCarouselPreview(postData);
        document.getElementById('download-pdf-btn').disabled = false;
    } catch (err) {
        postOutput.value = `Error: ${err.message}`;
        container.innerHTML = '<div class="carousel-placeholder">Error al generar.</div>';
    } finally {
        genBtn.disabled = false;
        genBtn.textContent = '⚡ Generar Post e Imágenes';
    }
}

// ─── 5. BUILD SLIDE ──────────────────────────────────────────
// Construye cada slide con divs reales (no pseudo-elementos CSS)
// para que html2canvas los pinte correctamente en el PDF.
function buildSlideEl(slide, index, total, sidepx) {
    // sidepx: tamaño en px del lado del slide (undefined = preview normal)
    const forPDF = !!sidepx;
    const S = sidepx || 0;

    const el = document.createElement('div');
    el.className = `slide-preview slide-${slide.type}`;

    if (slide.bg) {
        el.style.backgroundImage  = `url(${slide.bg})`;
        el.style.backgroundSize   = 'cover';
        el.style.backgroundPosition = 'center';
    }

    // ── Estilos inline sólo cuando se construye para PDF ──────
    if (forPDF) {
        // Tipografía base escalada a 1080px
        // En pantalla el slide mide ~500px → escala ≈ 2.16×
        // Usamos font-size base de 16px * (1080/500) ≈ 34px pero
        // ajustamos cada elemento individualmente abajo.
        el.style.cssText = `
            width:${S}px!important;
            height:${S}px!important;
            aspect-ratio:unset!important;
            position:relative!important;
            display:flex!important;
            flex-direction:column!important;
            justify-content:space-between!important;
            padding:${Math.round(S*0.052)}px!important;
            overflow:hidden!important;
            box-sizing:border-box!important;
            background-color:#0D0D0D;
            border-radius:0!important;
            box-shadow:none!important;
        `;
        if (slide.type === 'cta_clean')
            el.style.background = 'linear-gradient(145deg,#020f2a 0%,#001a5c 60%,#0a0a0a 100%)';
    }

    const pad    = forPDF ? Math.round(S * 0.052) : 56; // ~56px @ 1080
    const fs_h3  = forPDF ? Math.round(S * 0.075) : null; // ~81px @ 1080 → se ve como ~3rem@500px
    const fs_met = forPDF ? Math.round(S * 0.12)  : null;
    const fs_p   = forPDF ? Math.round(S * 0.025) : null;
    const fs_num = forPDF ? Math.round(S * 0.018) : null;
    const fs_ftr = forPDF ? Math.round(S * 0.018) : null;
    const dot_sz = forPDF ? Math.round(S * 0.010) : 7;
    const arrow_fs = forPDF ? Math.round(S * 0.045) : null;

    // ── Overlay (cover_bold) ──────────────────────────────────
    const overlayDiv = (slide.type === 'cover_bold')
        ? `<div style="position:absolute;inset:0;
               background:linear-gradient(160deg,rgba(0,0,0,0.88) 0%,rgba(0,71,171,0.75) 50%,rgba(0,0,0,0.95) 100%);
               z-index:1;pointer-events:none;"></div>`
        : '';

    // ── Marco neon (data_callout) ─────────────────────────────
    const framePad = forPDF ? Math.round(S * 0.026) : 28;
    const frameCorner = forPDF ? Math.round(S * 0.033) : 36;
    const frameDiv = (slide.type === 'data_callout')
        ? `<div style="position:absolute;top:${framePad}px;left:${framePad}px;right:${framePad}px;bottom:${framePad}px;
               border:${forPDF?2:1.5}px solid rgba(57,255,20,0.25);border-radius:8px;z-index:1;pointer-events:none;"></div>
           <div style="position:absolute;top:${framePad}px;left:${framePad}px;width:${frameCorner}px;height:${frameCorner}px;
               border-top:${forPDF?4:3}px solid #39FF14;border-left:${forPDF?4:3}px solid #39FF14;
               border-radius:8px 0 0 0;z-index:2;pointer-events:none;"></div>
           <div style="position:absolute;bottom:${framePad}px;right:${framePad}px;width:${frameCorner}px;height:${frameCorner}px;
               border-bottom:${forPDF?4:3}px solid #39FF14;border-right:${forPDF?4:3}px solid #39FF14;
               border-radius:0 0 8px 0;z-index:2;pointer-events:none;"></div>`
        : '';

    // ── Número de lámina ──────────────────────────────────────
    const numStyle = forPDF
        ? `position:absolute;top:${Math.round(S*0.016)}px;left:${Math.round(S*0.022)}px;
           font-family:'Space Grotesk',sans-serif;font-size:${fs_num}px;font-weight:700;
           letter-spacing:.15em;text-transform:uppercase;color:#555;z-index:10;
           background:rgba(0,0,0,.5);padding:${Math.round(S*.004)}px ${Math.round(S*.01)}px;border-radius:4px;`
        : '';
    const numLabel = `<span ${forPDF?`style="${numStyle}"`:'class="slide-num"'}>0${index+1} / 0${total}</span>`;

    // ── Flecha ────────────────────────────────────────────────
    const isLast = index === total - 1;
    const arrowStyle = forPDF
        ? `position:absolute;top:${pad}px;right:${pad}px;font-size:${arrow_fs}px;
           line-height:1;color:rgba(255,255,255,.22);z-index:10;`
        : '';
    const arrow = isLast ? '' : `<div ${forPDF?`style="${arrowStyle}"`:'class="slide-nav-arrow"'}>→</div>`;

    // ── Métrica ───────────────────────────────────────────────
    const metricStyle = forPDF
        ? `font-family:'Space Grotesk',sans-serif;font-size:${fs_met}px;font-weight:900;
           line-height:1;color:#39FF14;letter-spacing:-.04em;margin:${Math.round(S*.011)}px 0;`
        : '';
    const metricHTML = slide.metric
        ? `<div ${forPDF?`style="${metricStyle}"`:'class="slide-metric"'}>${slide.metric}</div>` : '';

    // ── Texto de apoyo ────────────────────────────────────────
    const pStyle = forPDF
        ? `font-family:'Inter',sans-serif;font-size:${fs_p}px;color:#9A9A9A;line-height:1.6;margin:0;` : '';
    const supportHTML = slide.supporting_text
        ? `<p ${forPDF?`style="${pStyle}"`:''}>${slide.supporting_text}</p>` : '';

    // ── H3 ────────────────────────────────────────────────────
    const h3Style = forPDF
        ? `font-family:'Space Grotesk',sans-serif;font-size:${fs_h3}px;font-weight:900;
           line-height:1.0;letter-spacing:-.02em;text-transform:uppercase;
           color:#fff;margin:0 0 ${Math.round(S*.015)}px;` : '';

    // ── Footer ────────────────────────────────────────────────
    const footerStyle = forPDF
        ? `display:flex;align-items:center;font-family:'Space Grotesk',sans-serif;
           font-size:${fs_ftr}px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
           color:#555;border-top:1px solid rgba(255,255,255,0.08);
           padding-top:${Math.round(S*.013)}px;margin-top:auto;position:relative;z-index:2;` : '';
    const dotStyle = forPDF
        ? `width:${dot_sz}px;height:${dot_sz}px;border-radius:50%;background:#39FF14;
           display:inline-block;margin-right:${Math.round(S*.007)}px;flex-shrink:0;` : '';
    const footer = `
        <div ${forPDF?`style="${footerStyle}"`:'class="slide-footer"'}>
            <span ${forPDF?`style="${dotStyle}"`:'class="dot"'}></span>smability.io
        </div>`;

    // ── Wrapper content ───────────────────────────────────────
    const wrapStyle = `position:relative;z-index:2;width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-between;`;
    const bodyInnerStyle = forPDF
        ? `flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding-top:${Math.round(S*.074)}px;`
        : 'flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding-top:80px;';

    el.innerHTML = `
        ${overlayDiv}
        ${frameDiv}
        ${numLabel}
        ${arrow}
        <div style="${wrapStyle}">
            <div style="${bodyInnerStyle}">
                <h3 ${forPDF?`style="${h3Style}"`:''}>${slide.headline}</h3>
                ${metricHTML}
                ${supportHTML}
            </div>
            ${footer}
        </div>`;

    return el;
}

// ─── 6. RENDER PREVIEW ───────────────────────────────────────
function renderCarouselPreview(postData) {
    const container = document.getElementById('carousel-preview-container');
    container.innerHTML = '';
    const total = postData.slides.length;
    postData.slides.forEach((slide, i) => {
        container.appendChild(buildSlideEl(slide, i, total)); // sin sidepx = modo preview
    });
}

// ─── 7. DESCARGA PDF ─────────────────────────────────────────
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

    // Host de dimensiones 0 — invisible, no afecta scroll ni layout
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;z-index:-9999;';
    const stage = document.createElement('div');
    stage.style.cssText = `position:absolute;top:0;left:0;width:${SIDE}px;height:${SIDE}px;overflow:hidden;visibility:hidden;`;
    host.appendChild(stage);
    document.body.appendChild(host);

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation:'portrait', unit:'px', format:[SIDE,SIDE], hotfixes:['px_scaling'], compress:true });
        const total = postData.slides.length;

        for (let i = 0; i < total; i++) {
            btn.textContent = `Capturando ${i+1}/${total}…`;

            // Construimos el clon con tamaños proporcionales a 1080px
            const clone = buildSlideEl(postData.slides[i], i, total, SIDE);

            // Fondo de color del tipo de slide
            if (!postData.slides[i].bg) {
                if (postData.slides[i].type === 'cta_clean')
                    clone.style.background = 'linear-gradient(145deg,#020f2a 0%,#001a5c 60%,#0a0a0a 100%)';
                else
                    clone.style.backgroundColor = '#0D0D0D';
            }

            stage.innerHTML = '';
            stage.appendChild(clone);

            // 2 frames para que el browser pinte fuentes e imágenes
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

            const canvas = await html2canvas(clone, {
                scale: 1,          // el clon ya es 1080px, scale:1 = 1080px output
                useCORS: true,
                allowTaint: false,
                logging: false,
                width: SIDE,
                height: SIDE,
                windowWidth: SIDE,
                windowHeight: SIDE,
                x: 0, y: 0,
                scrollX: 0, scrollY: 0,
                backgroundColor: '#0D0D0D',
                onclone: doc => {
                    const lnk = doc.createElement('link');
                    lnk.rel  = 'stylesheet';
                    lnk.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;900&family=Inter:wght@400;600&display=swap';
                    doc.head.appendChild(lnk);
                }
            });

            const img = canvas.toDataURL('image/jpeg', 0.95);
            if (i > 0) pdf.addPage([SIDE, SIDE], 'portrait');
            pdf.addImage(img, 'JPEG', 0, 0, SIDE, SIDE, `s${i}`, 'FAST');
        }

        btn.textContent = 'Guardando…';
        pdf.save(`Smability_Carrusel_${Date.now()}.pdf`);

    } catch (e) {
        console.error('PDF error:', e);
        alert(`Error: ${e.message}`);
    } finally {
        document.body.removeChild(host);
        btn.textContent = '↓ Descargar PDF para LinkedIn';
        btn.disabled = false;
    }
}

// ─── 8. HELPERS ──────────────────────────────────────────────
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
