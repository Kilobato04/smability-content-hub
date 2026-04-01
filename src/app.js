/* ============================================================
   SMABILITY CONTENT HUB — app.js
   ============================================================ */

let masterPlan           = null;
let currentSelectedMonth = 3;
let _lastEnrichedPost    = null;
let _logoBase64          = null;

// ─── LOGO ────────────────────────────────────────────────────
async function preloadLogo() {
    _logoBase64 = await imgToBase64('assets/logo.png');
}

// En PDF: siempre brightness(0) invert(1) — html2canvas no procesa
// filtros CSS complejos. La intensidad se controla con opacity.
// En pantalla: CSS filter normal.
function logoImg(height, isPDF, filter) {
    if (isPDF) {
        const src      = _logoBase64 || 'assets/logo.png';
        const isWhite  = filter && filter.includes('invert(1)');
        const opacity  = isWhite ? '1' : '0.45';
        return `<img src="${src}" height="${height}"
            style="width:auto;object-fit:contain;display:block;
            filter:brightness(0) invert(1);opacity:${opacity};" />`;
    }
    const flt = filter ? `filter:${filter};` : '';
    return `<img src="assets/logo.png" height="${height}"
        style="width:auto;object-fit:contain;display:block;${flt}" />`;
}

// ─── 1. INIT ────────────────────────────────────────────────

#--
document.addEventListener('DOMContentLoaded', () => {
    init();
    document.getElementById('generate-btn').addEventListener('click', generateContent);
    // Solo estas dos para descargas:
    document.getElementById('download-pdf-btn').addEventListener('click', () => downloadAssets('pdf'));
    document.getElementById('download-png-btn').addEventListener('click', () => downloadAssets('png'));

    document.getElementById('edit-horacio').addEventListener('click', () => toggleEdit('linkedin-post-output', 'edit-horacio'));
    document.getElementById('edit-smability').addEventListener('click', () => toggleEdit('smability-post-output', 'edit-smability'));
});

async function init() {
    try {
        const res = await fetch('data/master_abril.json');
        masterPlan = await res.json();
        populateSelector();
    } catch (e) { console.error('Error:', e); }
}


// ─── 3. SELECTOR ────────────────────────────────────────────
function populateSelector() {
    const sel = document.getElementById('post-selector');
    sel.innerHTML = '<option value="">Selecciona un post...</option>';
    masterPlan.pipeline.forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        const f = p.fecha.split('-').reverse().slice(0, 2).join('/');
        o.textContent = `${f} · ${p.cat} · ${p.slides[0].headline.substring(0, 38)}`;
        sel.appendChild(o);
    });
}

// ─── 4. GENERACIÓN ──────────────────────────────────────────
async function generateContent() {
    const postId = document.getElementById('post-selector').value;
    if (!postId) return alert('Selecciona un post del plan.');

    const postData = masterPlan.pipeline.find(p => p.id === postId);
    const genBtn = document.getElementById('generate-btn');
    
    genBtn.disabled = true;
    genBtn.textContent = 'Generando Mix B2B...';

   // Localiza la parte de las respuestas en generateContent y asegúrate que se vea así:
   try {
       const [resH, resS] = await Promise.all([
           fetchPost(postData, 'horacio'),
           fetchPost(postData, 'smability')
       ]);
   
       // Validación de seguridad para evitar el "undefined"
       document.getElementById('linkedin-post-output').value = resH.linkedin_post || "Error en respuesta Horacio";
       document.getElementById('smability-post-output').value = resS.linkedin_post || "Error en respuesta Smability";
   
       // Si hay error en los textos, al menos renderiza el reel con los datos del JSON
       const enriched = build5Slides(postData, resH);
       renderCarouselPreview(enriched);
       document.getElementById('download-pdf-btn').disabled = false;
       document.getElementById('download-png-btn').disabled = false;
   
   } catch (err) {
       console.error("Error capturado:", err);
       alert("Hubo un error de conexión con la API (502). Revisa los logs de Netlify.");
   } finally {
        genBtn.disabled = false;
        genBtn.textContent = '⚡ Generar Post e Imágenes';
    }
}
    

// Función helper para la llamada a API
async function fetchPost(postData, target) {
    const res = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            technical_data: postData.datos,
            category: postData.cat,
            headline: postData.slides[0].headline,
            target: target // 'horacio' o 'smability' 
        })
    });
    return res.json();
}

function toggleEdit(id, btnId) {
    const area = document.getElementById(id);
    const btn = document.getElementById(btnId);
    area.readOnly = !area.readOnly;
    area.style.backgroundColor = area.readOnly ? '' : 'rgba(255,255,255,0.05)';
    btn.textContent = area.readOnly ? 'Editar' : 'Guardar';
}

function copyText(id) {
    const area = document.getElementById(id);
    if (!area || !area.value) return;
    
    navigator.clipboard.writeText(area.value).then(() => {
        alert('Texto copiado al portapapeles');
    }).catch(err => {
        console.error('Error al copiar:', err);
    });
}

// ─── 5. BUILD 5 SLIDES FIJOS ────────────────────────────────
function build5Slides(postData, aiData) {
    const src     = postData.slides;
    const cover   = src.find(s => s.type === 'cover_bold') || src[0];
    const stat    = src.find(s => s.type === 'data_callout') || src[1] || src[0];
    const cta     = src.find(s => s.type === 'cta_clean') || src[src.length - 1];
    const cat     = postData.cat;

    // Buscamos la segunda imagen de fondo disponible para el cierre
    // Si no hay una segunda específica, usamos la misma del cover
    const secondBg = src[1]?.bg || cover.bg;

    return {
        ...postData,
        slides: [
            {
                type:     'cover_bold',
                bg:       cover.bg || null, // FONDO 1: Portada
                cat_tag:  cat,
                headline: cover.headline,
                ai_hook:  aiData.hook || null,
                metric:   cover.metric || null
            },
            {
                type:        'data_callout', // LÁMINA WOW: Gráfica Python
                bg:          null,           // SIN FONDO: Para que luzca la gráfica
                cat_tag:     null,
                headline:    stat.headline,
                metric:      stat.metric || aiData.stat_number || '—',
                ai_stat_ctx: aiData.stat_ctx || stat.supporting_text || ''
                // Aquí es donde inyectaremos la imagen generada por Python (wow_chart.png)
            },
            {
                type:     'bullets',
                bg:       null, // SIN FONDO: Enfoque técnico
                cat_tag:  cat,
                headline: aiData.bullets_title || '¿Por qué importa?',
                bullets:  aiData.bullets
            },
            {
                type:          'split_map',
                bg:            null, // SIN FONDO
                cat_tag:       null,
                headline:      aiData.insight_title || 'El dato que cambia la decisión',
                ai_body:       aiData.insight_body || '',
                metric:        aiData.insight_metric || null,
                metric_label:  aiData.insight_metric_label || ''
            },
            {
                type:          'cta_clean',
                bg:            secondBg, // FONDO 2: Cierre (Imagen soporte)
                cat_tag:       null,
                headline:      cta.headline,
                ai_body:       aiData.cta_body || '',
                ai_cta_label:  aiData.cta_label || 'Agenda una demo'
            }
        ]
    };
}

// ─── 6. UTILIDAD: imagen → base64 ───────────────────────────
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
            padding:${Math.round(S * 0.052)}px;
            overflow:hidden;box-sizing:border-box;
            border-radius:0;box-shadow:none;`;
        if (slide.type === 'cta_clean')
            el.style.background = 'linear-gradient(145deg,#020f2a 0%,#001a5c 60%,#0a0a0a 100%)';
    }

    // Escala tipográfica
    const pad       = isPDF ? Math.round(S * 0.052) : 56;
    const fs_tag    = isPDF ? Math.round(S * 0.020) : 12;
    const fs_h3     = isPDF ? Math.round(S * 0.083) : 52;
    const fs_hook   = isPDF ? Math.round(S * 0.030) : 19;
    const fs_body   = isPDF ? Math.round(S * 0.026) : 16;
    const fs_met    = isPDF ? Math.round(S * 0.148) : 90;
    const fs_ctx    = isPDF ? Math.round(S * 0.026) : 16;
    const fs_bullet = isPDF ? Math.round(S * 0.030) : 19;
    const fs_num    = isPDF ? Math.round(S * 0.018) : 11;
    const fs_ftr    = isPDF ? Math.round(S * 0.018) : 11;
    const fs_arrow  = isPDF ? Math.round(S * 0.044) : 28;
    const dot_sz    = isPDF ? Math.round(S * 0.010) : 7;
    const gap       = isPDF ? Math.round(S * 0.018) : 14;
    const fp        = isPDF ? Math.round(S * 0.026) : 28;
    const fc        = isPDF ? Math.round(S * 0.033) : 36;
    const bnum_sz   = isPDF ? Math.round(S * 0.018) : 11;

    // Overlay: cover_bold = gradiente; cualquier otra lámina con bg = negro semi
    const overlayDiv = (slide.bg && slide.type !== 'cta_clean') ? `
        <div style="position:absolute;inset:0;
            background:${slide.type === 'cover_bold'
                ? 'linear-gradient(160deg,rgba(0,0,0,0.88) 0%,rgba(0,71,171,0.75) 50%,rgba(0,0,0,0.95) 100%)'
                : 'rgba(0,0,0,0.72)'};
            z-index:1;pointer-events:none;"></div>` : '';

    // Marco neon data_callout
    const bw = isPDF ? 4 : 3;
    const frameDiv = slide.type === 'data_callout' ? `
        <div style="position:absolute;top:${fp}px;left:${fp}px;right:${fp}px;bottom:${fp}px;
            border:${isPDF ? 2 : 1.5}px solid rgba(57,255,20,0.25);border-radius:8px;
            z-index:1;pointer-events:none;"></div>
        <div style="position:absolute;top:${fp}px;left:${fp}px;width:${fc}px;height:${fc}px;
            border-top:${bw}px solid #39FF14;border-left:${bw}px solid #39FF14;
            border-radius:8px 0 0 0;z-index:2;pointer-events:none;"></div>
        <div style="position:absolute;bottom:${fp}px;right:${fp}px;width:${fc}px;height:${fc}px;
            border-bottom:${bw}px solid #39FF14;border-right:${bw}px solid #39FF14;
            border-radius:0 0 8px 0;z-index:2;pointer-events:none;"></div>` : '';

    // Número de lámina
    const numTop  = isPDF ? Math.round(S * 0.045) : 48;
    const numLeft = isPDF ? Math.round(S * 0.022) : 24;
    const numLabel = `<span style="
        position:absolute;top:${numTop}px;left:${numLeft}px;
        font-family:'Space Grotesk',sans-serif;
        font-size:${fs_num}px;font-weight:700;letter-spacing:.15em;
        text-transform:uppercase;color:#555;z-index:10;
        background:rgba(0,0,0,0.5);
        padding:${isPDF ? Math.round(S * .003) : 3}px ${isPDF ? Math.round(S * .008) : 8}px;
        border-radius:4px;">0${index + 1} / 0${total}</span>`;

    // Flecha verde neon
    const isLast = index === total - 1;
    const arrow = isLast ? '' : `<div style="
        position:absolute;top:${pad}px;right:${pad}px;
        font-size:${fs_arrow}px;line-height:1;
        color:#39FF14;z-index:10;user-select:none;">→</div>`;

    // Pill categoría
    const catTag = slide.cat_tag ? `<div style="
        display:inline-block;
        background:rgba(57,255,20,0.12);border:1px solid #39FF14;color:#39FF14;
        font-family:'Space Grotesk',sans-serif;
        font-size:${fs_tag}px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
        padding:${isPDF ? Math.round(S * .005) : 4}px ${isPDF ? Math.round(S * .012) : 10}px;
        border-radius:4px;margin-bottom:${gap}px;">${slide.cat_tag}</div>` : '';

    // Footer con logo
    const ftrLogoH = isPDF ? Math.round(S * 0.028) : 18;
    const footer = `<div style="
        display:flex;align-items:center;justify-content:space-between;
        font-family:'Space Grotesk',sans-serif;
        font-size:${fs_ftr}px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
        color:#555;border-top:1px solid rgba(255,255,255,0.08);
        padding-top:${isPDF ? Math.round(S * .013) : 14}px;
        margin-top:auto;position:relative;z-index:2;">
        <div style="display:flex;align-items:center;gap:${isPDF ? Math.round(S * .007) : 8}px;">
            <span style="width:${dot_sz}px;height:${dot_sz}px;border-radius:50%;
                background:#39FF14;display:inline-block;flex-shrink:0;"></span>
            <span>smability.io</span>
        </div>
        ${logoImg(ftrLogoH, isPDF, 'brightness(0) invert(0.4)')}
    </div>`;

    // ── Contenido por tipo ───────────────────────────────────
    let bodyContent  = '';
    const bodyPadTop = isPDF ? Math.round(S * 0.08) : 90;
    const isDataCallout = slide.type === 'data_callout';

    if (slide.type === 'cover_bold') {
        const coverLogoH = isPDF ? Math.round(S * 0.050) : 32;
        const hookLine = slide.ai_hook ? `
            <p style="
                font-family:'Inter',sans-serif;
                font-size:${fs_hook}px;font-weight:600;
                color:#9A9A9A;line-height:1.4;margin:0;
                border-left:${isPDF ? Math.round(S * .004) : 3}px solid #39FF14;
                padding-left:${isPDF ? Math.round(S * .016) : 13}px;">
                ${slide.ai_hook}</p>` : '';

        bodyContent = `
            <div style="position:absolute;top:${pad}px;right:${pad}px;z-index:10;">
                ${logoImg(coverLogoH, isPDF, 'brightness(0) invert(1)')}
            </div>
            ${catTag}
            <h3 style="
                font-family:'Space Grotesk',sans-serif;
                font-size:${fs_h3}px;font-weight:900;line-height:0.95;
                letter-spacing:-.03em;text-transform:uppercase;
                color:#fff;margin:0 0 ${gap * 1.5}px;">
                ${slide.headline}</h3>
            ${hookLine}`;

    } else if (slide.type === 'data_callout') {
    const chartId = `wowChart-${index}`;
    bodyContent = `
        <div style="text-align:left; width:100%;">
            <p style="font-family:'Space Grotesk',sans-serif; font-size:14px; color:#39FF14; font-weight:700; letter-spacing:2px; margin-bottom:10px;">ANÁLISIS TÉCNICO // 2026</p>
            <h3 style="font-size:24px; margin-bottom:15px;">${slide.headline}</h3>
            <div id="${chartId}" style="width:100%; height:320px;"></div>
            <p style="font-family:'Inter',sans-serif; font-size:14px; color:#9A9A9A; margin-top:15px; line-height:1.5;">${slide.ai_stat_ctx}</p>
        </div>`;
    
    // Ejecutamos Plotly después de que el elemento exista en el DOM
    setTimeout(() => renderWowPlotly(chartId), 100);
    } else if (slide.type === 'bullets') {
        const items      = (slide.bullets || []).slice(0, 4);
        const bulletRows = items.map((b, bi) => `
            <div style="
                display:flex;align-items:flex-start;
                gap:${isPDF ? Math.round(S * .018) : 16}px;
                padding:${isPDF ? Math.round(S * .018) : 16}px 0;
                border-bottom:1px solid rgba(255,255,255,0.07);">
                <span style="
                    font-family:'Space Grotesk',sans-serif;
                    font-size:${bnum_sz}px;font-weight:700;
                    color:#39FF14;letter-spacing:.1em;
                    min-width:${isPDF ? Math.round(S * .032) : 26}px;
                    padding-top:${isPDF ? Math.round(S * .004) : 3}px;flex-shrink:0;">
                    0${bi + 1}</span>
                <span style="
                    font-family:'Inter',sans-serif;
                    font-size:${fs_bullet}px;font-weight:600;
                    color:#F0F0F0;line-height:1.35;">
                    ${b}</span>
            </div>`).join('');

        bodyContent = `
            ${catTag}
            <h3 style="
                font-family:'Space Grotesk',sans-serif;
                font-size:${isPDF ? Math.round(S * .050) : 32}px;font-weight:900;
                line-height:1.0;letter-spacing:-.02em;text-transform:uppercase;
                color:#fff;margin:0 0 ${gap}px;">
                ${slide.headline}</h3>
            <div style="flex:1;">${bulletRows}</div>`;

    } else if (slide.type === 'split_map') {
        const hasMetric   = !!slide.metric;
        const insightBody = slide.ai_body || '';

        if (hasMetric) {
            const rightW   = isPDF ? Math.round(S * .42) : 210;
            const leftW    = isPDF ? Math.round(S * .46) : 230;
            const splitGap = isPDF ? Math.round(S * .02) : 16;
            const metFs    = isPDF ? Math.round(S * .095) : 58;
            const metLblFs = isPDF ? Math.round(S * .017) : 10;
            const h3SmFs   = isPDF ? Math.round(S * .056) : 34;
            const rightPad = isPDF ? Math.round(S * .03) : 20;

            bodyContent = `
                <div style="display:flex;gap:${splitGap}px;align-items:stretch;
                    flex:1;min-height:0;width:100%;">
                    <div style="width:${leftW}px;flex-shrink:0;
                        display:flex;flex-direction:column;justify-content:center;gap:${gap}px;">
                        ${catTag}
                        <h3 style="font-family:'Space Grotesk',sans-serif;
                            font-size:${h3SmFs}px;font-weight:900;
                            line-height:1.0;letter-spacing:-.02em;text-transform:uppercase;
                            color:#fff;margin:0;">
                            ${slide.headline}</h3>
                        <p style="font-family:'Inter',sans-serif;font-size:${fs_body}px;
                            color:#9A9A9A;line-height:1.65;margin:0;
                            border-left:${isPDF ? Math.round(S * .003) : 2}px solid rgba(57,255,20,0.5);
                            padding-left:${isPDF ? Math.round(S * .014) : 12}px;">
                            ${insightBody}</p>
                    </div>
                    <div style="width:${rightW}px;flex-shrink:0;
                        background:rgba(255,255,255,0.03);
                        border-left:1px solid rgba(255,255,255,0.08);
                        border-radius:0 6px 6px 0;
                        display:flex;flex-direction:column;
                        align-items:center;justify-content:center;
                        padding:${rightPad}px;box-sizing:border-box;">
                        <div style="font-family:'Space Grotesk',sans-serif;
                            font-size:${metFs}px;font-weight:900;
                            color:#39FF14;letter-spacing:-.04em;line-height:1;
                            text-align:center;word-break:break-word;max-width:100%;">
                            ${slide.metric}</div>
                        <div style="font-family:'Space Grotesk',sans-serif;
                            font-size:${metLblFs}px;font-weight:700;
                            letter-spacing:.12em;text-transform:uppercase;color:#555;
                            margin-top:${Math.round(gap * .7)}px;
                            text-align:center;line-height:1.3;">
                            ${slide.metric_label || ''}</div>
                    </div>
                </div>`;
        } else {
            bodyContent = `
                ${catTag}
                <h3 style="font-family:'Space Grotesk',sans-serif;
                    font-size:${isPDF ? Math.round(S * .070) : 44}px;font-weight:900;
                    line-height:1.0;letter-spacing:-.02em;text-transform:uppercase;
                    color:#fff;margin:0 0 ${gap * 1.4}px;">
                    ${slide.headline}</h3>
                <p style="font-family:'Inter',sans-serif;font-size:${fs_body}px;
                    color:#9A9A9A;line-height:1.7;margin:0;
                    border-left:${isPDF ? Math.round(S * .003) : 2}px solid rgba(57,255,20,0.4);
                    padding-left:${isPDF ? Math.round(S * .014) : 12}px;">
                    ${insightBody}</p>`;
        }

    } else if (slide.type === 'cta_clean') {
    const ctaLabel = slide.ai_cta_label || 'Agenda una demo';
    const qrUrl = "https://www.smability.io/aire/gpt.html";
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`;
    const qrBoxSize = isPDF ? Math.round(S * 0.13) : 100;

    // Inyectamos el Overlay antes del contenido
    bodyContent = `
        <div class="cover-overlay" style="position:absolute; inset:0; 
            background: linear-gradient(160deg, rgba(0,26,77,0.95) 0%, rgba(5,5,5,0.85) 100%); 
            z-index:1; pointer-events:none;"></div>
            
        <div style="position:relative; z-index:2; width:100%;">
            <h3 style="font-family:'Space Grotesk',sans-serif;
                font-size:${isPDF ? Math.round(S * .083) : 52}px; font-weight:900;
                line-height:0.95; letter-spacing:-.03em; text-transform:uppercase;
                color:#fff; margin:0 0 ${gap}px;">
                ${slide.headline}</h3>
            
            <div style="display:flex; align-items:center; gap:20px; margin-bottom:${gap * 1.5}px;">
                <div style="width:${qrBoxSize}px; height:${qrBoxSize}px; background:#fff; padding:8px; border-radius:6px; flex-shrink:0;">
                    <img src="${qrApi}" style="width:100%; height:100%;" alt="QR AIreGPT">
                </div>
                <p style="font-family:'Inter',sans-serif; font-size:${isPDF ? Math.round(S * .024) : 16}px; color:#9A9A9A; line-height:1.4; margin:0;">
                    Escanea para probar <strong style="color:#39FF14;">AIreGPT</strong> en vivo<br>
                    o visita: <span style="color:#FFFFFF; text-decoration:underline;">smability.io/aire/gpt.html</span>
                </p>
            </div>

            <div style="display:inline-flex; align-items:center;
                border:2px solid #39FF14; border-radius:6px;
                padding:${isPDF ? Math.round(S * .016) : 17}px ${isPDF ? Math.round(S * .030) : 32}px;
                font-family:'Space Grotesk',sans-serif;
                font-size:${isPDF ? Math.round(S * .024) : 15}px;
                font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#39FF14;">
                ↗ ${ctaLabel}</div>
        </div>`;
   }

    // Footer absoluto para data_callout (centrada verticalmente)
    const dataCalloutFooter = isDataCallout ? `
        <div style="position:absolute;bottom:${pad}px;left:${pad}px;right:${pad}px;
            display:flex;align-items:center;justify-content:space-between;z-index:2;
            font-family:'Space Grotesk',sans-serif;
            font-size:${fs_ftr}px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
            color:#555;border-top:1px solid rgba(255,255,255,0.08);
            padding-top:${isPDF ? Math.round(S * .013) : 14}px;">
            <div style="display:flex;align-items:center;gap:${isPDF ? Math.round(S * .007) : 8}px;">
                <span style="width:${dot_sz}px;height:${dot_sz}px;border-radius:50%;
                    background:#39FF14;display:inline-block;flex-shrink:0;"></span>
                <span>smability.io</span>
            </div>
            ${logoImg(isPDF ? Math.round(S * 0.028) : 18, isPDF, 'brightness(0) invert(0.4)')}
        </div>` : '';

    el.innerHTML = `
        ${overlayDiv}
        ${frameDiv}
        ${numLabel}
        ${arrow}
        <div style="position:relative;z-index:2;width:100%;height:100%;
            display:flex;flex-direction:column;
            justify-content:${isDataCallout ? 'center' : 'space-between'};
            align-items:${isDataCallout ? 'center' : 'stretch'};
            text-align:${isDataCallout ? 'center' : 'left'};">
            <div style="${isDataCallout
                ? 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
                : `flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding-top:${bodyPadTop}px;`}">
                ${bodyContent}
            </div>
            ${isDataCallout ? '' : footer}
        </div>
        ${dataCalloutFooter}`;

    return el;
}

// ─── 8. RENDER PREVIEW ──────────────────────────────────────
function renderCarouselPreview(postData) {
    _lastEnrichedPost = postData;
    const container   = document.getElementById('carousel-preview-container');
    container.innerHTML = '';
    const total = postData.slides.length;
    postData.slides.forEach((slide, i) => {
        container.appendChild(buildSlideEl(slide, i, total));
    });
}

// ─── 9. DESCARGA PDF-PNG ────────────────────────────────────────
async function downloadAssets(format) {
    const container = document.getElementById('carousel-preview-container');
    const slides = container.querySelectorAll('.slide-preview');
    if (slides.length === 0) return;

    const btn = format === 'pdf' ? document.getElementById('download-pdf-btn') : document.getElementById('download-png-btn');
    const originalText = btn.textContent;
    btn.textContent = "Procesando...";
    btn.disabled = true;

    const zip = format === 'png' ? new JSZip() : null;
    const { jsPDF } = window.jspdf;
    const pdf = format === 'pdf' ? new jsPDF({ orientation: 'p', unit: 'px', format: [1080, 1080] }) : null;

    try {
        for (let i = 0; i < slides.length; i++) {
            btn.textContent = `Capturando ${i + 1}/${slides.length}...`;
            
            // Forzar renderizado de Plotly antes de capturar
            const chartDiv = slides[i].querySelector('[id^="wowChart-"]');
            if (chartDiv) {
                await Plotly.Plots.resize(chartDiv);
            }

            const canvas = await html2canvas(slides[i], {
                scale: 2, // Calidad Retina
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#001A4D',
                logging: false,
                onclone: (clonedDoc) => {
                    // FORZAR LOGOS BLANCOS EN EL RENDERIZADO DE CAPTURA
                    const logos = clonedDoc.querySelectorAll('img');
                    logos.forEach(img => {
                        if(img.src.includes('logo')) {
                            img.style.filter = 'brightness(0) invert(1)';
                            img.style.opacity = '1';
                        }
                    });
                }
            });

            const imgData = canvas.toDataURL('image/png');

            if (format === 'png') {
                const b64Data = imgData.replace(/^data:image\/(png|jpg);base64,/, "");
                zip.file(`Smability_Slide_${i + 1}.png`, b64Data, {base64: true});
            } else {
                if (i > 0) pdf.addPage([1080, 1080], 'p');
                pdf.addImage(imgData, 'PNG', 0, 0, 1080, 1080);
            }
        }

        if (format === 'png') {
            const content = await zip.generateAsync({type:"blob"});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `Smability_Post_Imágenes_${Date.now()}.zip`;
            link.click();
        } else {
            pdf.save(`Smability_Reel_LinkedIn_${Date.now()}.pdf`);
        }

    } catch (err) {
        console.error("Error en captura:", err);
        alert("Error al procesar las láminas.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

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

function renderWowPlotly(elementId) {
    const trace1 = {
        x: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
        y: [15, 22, 18, 45, 38, 42],
        type: 'scatter',
        mode: 'lines+markers',
        name: 'SMAA IoT',
        line: { color: '#39FF14', width: 4, shape: 'spline' },
        marker: { size: 10, color: '#001A4D', line: { color: '#39FF14', width: 2 } }
    };

    const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 30, r: 10, t: 10, b: 30 },
        showlegend: false,
        xaxis: {
            gridcolor: 'rgba(255,255,255,0.05)',
            tickfont: { color: '#555', size: 10 },
            showline: false
        },
        yaxis: {
            gridcolor: 'rgba(255,255,255,0.05)',
            tickfont: { color: '#555', size: 10 },
            showline: false
        }
    };

    const config = { responsive: true, displayModeBar: false };

    Plotly.newPlot(elementId, [trace1], layout, config);
}
