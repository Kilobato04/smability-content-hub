/* ============================================================
   SMABILITY CONTENT HUB — app.js
   ============================================================ */

let masterPlan           = null;
let currentSelectedMonth = 3;
let _lastEnrichedPost    = null;
let _logoBase64          = null;

// ─── CONFIGURACIÓN VISUAL ────────────────────────────────────
const SMABILITY_PALETTE = [
    '#001A4D', // Navy Original (Tu marca)
    '#2E0854', // MORADO (Contingencia - IAS Máximo)
    '#0047AB', // Azul Cobalto (Energía técnica)
    '#2E0854', // Púrpura Profundo (Innovación/Deep Tech)
    '#4A0404', // Rojo Óxido (Alerta/Calor)
    '#013220', // Verde Bosque Muy Oscuro (Sostenibilidad)
    '#5C2B00', // Naranja Quemado (Infraestructura)
    '#1A1A1B'  // Grafito Mate (El toque sobrio)
];

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

document.addEventListener('DOMContentLoaded', () => {
    init();
    
    // Listeners de Generación y Descarga
    const genBtn = document.getElementById('generate-btn');
    const pdfBtn = document.getElementById('download-pdf-btn');
    const pngBtn = document.getElementById('download-png-btn');

    if (genBtn) genBtn.addEventListener('click', generateContent);
    if (pdfBtn) pdfBtn.addEventListener('click', () => downloadAssets('pdf'));
    if (pngBtn) pngBtn.addEventListener('click', () => downloadAssets('png'));

});

async function init() {
    try {
        const res = await fetch('data/master_abril.json');
        if (!res.ok) throw new Error("Error cargando JSON");
        masterPlan = await res.json();
        populateSelector();
    } catch (e) { 
        console.error('Error en init:', e);
        const sel = document.getElementById('post-selector');
        if (sel) sel.innerHTML = '<option value="">Error al cargar posts</option>';
    }
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
    const src = postData.slides;
    const cat = postData.cat;
    const isContingencia = cat === 'CONTINGENCIA';
    const sessionColor = isContingencia ? '#2E0854' : SMABILITY_PALETTE[Math.floor(Math.random() * SMABILITY_PALETTE.length)];

    return {
        ...postData,
        sessionBg: sessionColor,
        slides: [
            {
                type: 'cover_bold',
                cat_tag: cat,
                headline: src[0].headline,
                ai_hook: aiData.hook || null
            },
            {
                type: 'data_callout',
                bg: src[1].bg || 'assets/analysis/heatmap_ibero_1.jpg',
                isAnalysis: true,
                device_tag: src[1].device_tag || 'SMAA',
                headline: src[1].headline,
                technical_specs: postData.datos.technical_specs || '',
                ai_stat_ctx: aiData.stat_ctx || src[1].supporting_text || ''
            },
            {
                type: 'bullets',
                cat_tag: cat,
                headline: aiData.bullets_title || 'Protocolo Técnico',
                bullets: aiData.bullets
            },
            {
                type: 'split_map',
                headline: src[3]?.headline || 'Dato Crítico',
                ai_body: postData.datos.datos_hardcoded || aiData.insight_body || '',
                metric: src[3]?.metric || aiData.insight_metric || null,
                metric_label: src[3]?.metric_label || ''
            },
            {
                type: 'cta_clean',
                headline: src[src.length - 1].headline,
                ai_body: aiData.cta_body || '',
                ai_cta_label: aiData.cta_label || 'Probar AIreGPT'
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

    const sessionBg = _lastEnrichedPost.sessionBg || '#001A4D';
    el.style.backgroundColor = sessionBg;

    const isAnalysisSlide = slide.bg && (slide.bg.includes('analysis') || slide.isAnalysis);
    const bgUrl = isPDF ? bgBase64 : (isAnalysisSlide ? slide.bg : null);

    if (bgUrl) {
        el.style.backgroundImage    = `url(${bgUrl})`;
        el.style.backgroundSize     = 'cover';
        el.style.backgroundPosition = 'center';
    } else {
        el.style.backgroundImage = 'none';
    }

    if (isPDF) {
        el.style.cssText = `background-image:${bgUrl ? `url(${bgUrl})` : 'none'}; background-size:cover; background-position:center; background-color:${sessionBg}; width:${S}px; height:${S}px; aspect-ratio:unset; position:relative; display:flex; flex-direction:column; justify-content:space-between; padding:${Math.round(S * 0.052)}px; overflow:hidden; box-sizing:border-box; border-radius:0; box-shadow:none;`;
    }

    const pad = isPDF ? Math.round(S * 0.052) : 56;
    const fs_h3 = isPDF ? Math.round(S * 0.083) : 52;
    const gap = isPDF ? Math.round(S * 0.018) : 14;

    const overlayDiv = (bgUrl && !isAnalysisSlide) ? `
        <div style="position:absolute;inset:0; background:${slide.type === 'cover_bold' ? 'linear-gradient(160deg,rgba(0,0,0,0.85) 0%,rgba(0,71,171,0.6) 50%,rgba(0,0,0,0.9) 100%)' : 'rgba(0,0,0,0.72)'}; z-index:1;pointer-events:none;"></div>` : '';

    // --- LÓGICA DE CONTENIDO REAL (LO QUE FALTABA) ---
    let bodyContent = '';

    if (slide.type === 'cover_bold') {
        const coverLogoH = isPDF ? Math.round(S * 0.050) : 32;
        bodyContent = `
            <div style="position:absolute; top:${pad}px; right:${pad}px; z-index:10; text-align:right;">
                ${logoImg(coverLogoH, isPDF, 'brightness(0) invert(1)')}
            </div>
            <div style="margin-top: auto; position:relative; z-index:10;">
                <div class="status-badge" style="display:inline-block; margin-bottom:${gap}px; background:#39FF14; color:#000; padding:6px 14px; border-radius:100px; font-weight:800; font-size:12px; font-family:'Space Grotesk';">${slide.cat_tag}</div>
                <h3 style="font-family:'Space Grotesk'; font-size:${fs_h3}px; font-weight:900; line-height:0.95; color:#fff; text-transform:uppercase;">${slide.headline}</h3>
                ${slide.ai_hook ? `<p style="border-left:4px solid #39FF14; padding-left:20px; margin-top:30px; color:#9A9A9A; font-weight:600; font-size:20px; line-height:1.4;">${slide.ai_hook}</p>` : ''}
            </div>`;

    } else if (slide.type === 'data_callout') {
        const deviceCircleSize = isPDF ? Math.round(S * 0.12) : 90;
        bodyContent = `
            <div style="text-align:left; width:100%; height:100%; position:relative; padding-top:60px; z-index:10;">
                <div class="device-circle" style="position:absolute; top:0; right:0; width:${deviceCircleSize}px; height:${deviceCircleSize}px; background:#222; border:2px solid #39FF14; border-radius:50%; display:flex; align-items:center; justify-content:center; overflow:hidden; z-index:11;">
                    <img src="assets/devices/${(slide.device_tag || 'SMAA').toLowerCase()}.png" style="width:70%; filter: brightness(1.5);" onerror="this.style.display='none'">
                </div>
                
                <p style="font-family:'Space Grotesk'; font-size:14px; color:#0047AB; font-weight:800; letter-spacing:2px; margin-bottom:10px; text-shadow: 0 1px 2px rgba(255,255,255,0.5);">ANÁLISIS TÉCNICO // 2026</p>
                <h3 style="font-size:32px; color:#111; font-weight:900; line-height:1.1; margin-bottom:20px; text-transform:uppercase;">${slide.headline}</h3>
                
                <div style="flex:1;"></div>

                <div class="tech-specs-box" style="position:absolute; bottom:20px; right:0; width:220px; background:rgba(255,255,255,0.95); border-left:6px solid #39FF14; padding:18px; color:#111; box-shadow: -10px 10px 30px rgba(0,0,0,0.15);">
                    <b style="font-family:'Space Grotesk'; font-size:11px; color:#0047AB; text-transform:uppercase; display:block; margin-bottom:8px; letter-spacing:1px;">Ficha Técnica:</b>
                    <p style="font-family:'Inter'; font-size:13px; font-weight:700; line-height:1.4; margin:0; color:#333;">${(slide.technical_specs || '').replace(/\n/g, '<br>')}</p>
                </div>
            </div>`;

    } else if (slide.type === 'bullets') {
        const bulletItems = (slide.bullets || []).map((b, i) => `
            <div style="display:flex; align-items:flex-start; gap:20px; padding:20px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
                <span style="color:#39FF14; font-family:'Space Grotesk'; font-weight:900; font-size:18px;">0${i+1}</span>
                <span style="color:#fff; font-weight:600; font-size:22px; line-height:1.3;">${b}</span>
            </div>`).join('');
        bodyContent = `<div style="margin-top:60px; position:relative; z-index:10;"><h3 style="font-size:32px; margin-bottom:30px; font-weight:900;">${slide.headline}</h3><div>${bulletItems}</div></div>`;

    } else if (slide.type === 'split_map') {
        bodyContent = `
            <div style="display:flex; flex-direction:column; justify-content:center; height:100%; padding-top:40px; position:relative; z-index:10;">
                <h3 style="font-size:42px; font-weight:900; color:#fff; margin-bottom:25px; text-transform:uppercase; line-height:1;">${slide.headline}</h3>
                <p style="font-size:22px; color:#F0F0F0; border-left:5px solid #39FF14; padding-left:25px; line-height:1.5; margin-bottom:30px; font-weight:600;">${slide.ai_body}</p>
                ${slide.metric ? `<div style="font-size:80px; font-weight:900; color:#39FF14; letter-spacing:-2px;">${slide.metric}</div>` : ''}
            </div>`;

    } else if (slide.type === 'cta_clean') {
        bodyContent = `
            <div style="height:100%; display:flex; flex-direction:column; justify-content:center; position:relative; z-index:10;">
                <h3 style="font-size:54px; font-weight:900; margin-bottom:40px; line-height:0.95;">${slide.headline}</h3>
                <div style="display:flex; align-items:center; gap:25px; background:rgba(255,255,255,0.05); padding:20px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="width:120px; height:120px; background:#fff; padding:10px; border-radius:8px; flex-shrink:0;">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://smability.io/aire/gpt.html" style="width:100%;">
                    </div>
                    <div>
                        <p style="color:#fff; font-weight:800; font-size:20px; margin-bottom:5px;">AIreGPT v2.6</p>
                        <p style="color:#9A9A9A; font-weight:600; font-size:16px;">Escanea para probar el monitoreo en tiempo real.</p>
                    </div>
                </div>
            </div>`;
    }

    const isDataCallout = slide.type === 'data_callout';
    const numLabel = `<span style="position:absolute; top:18px; left:24px; font-family:'Space Grotesk'; font-size:11px; font-weight:700; color:rgba(255,255,255,0.5); z-index:15; background:rgba(0,0,0,0.4); padding:3px 8px; border-radius:4px;">0${index + 1} / 0${total}</span>`;

    el.innerHTML = `
        ${overlayDiv}
        ${numLabel}
        <div style="position:relative; z-index:10; height:100%; display:flex; flex-direction:column; justify-content:space-between;">
            <div style="flex:1; display:flex; flex-direction:column; justify-content:${isDataCallout ? 'flex-start' : 'center'};">
                ${bodyContent}
            </div>
            ${isDataCallout ? '' : `<div style="border-top:1px solid rgba(255,255,255,0.15); padding-top:15px; margin-top:20px; font-family:'Space Grotesk'; font-size:12px; color:rgba(255,255,255,0.5); font-weight:700; display:flex; align-items:center; gap:8px;">
                <span style="width:8px; height:8px; background:#39FF14; border-radius:50%; display:inline-block;"></span> smability.io
            </div>`}
        </div>`;

    // FIX CONTRASTE CLARO
    if (['#F5F5F5', '#FFFFFF', '#EAEAEA'].includes(sessionBg)) {
        el.style.color = '#111111';
    }

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
                backgroundColor: _lastEnrichedPost.sessionBg,
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

/* ============================================================
   10. HELPERS / UTILIDADES
   ============================================================ */

function toggleEdit(textareaId, buttonId) {
    const area = document.getElementById(textareaId);
    const btn = document.getElementById(buttonId);
    
    if (!area || !btn) return; // Seguridad por si los IDs cambian

    if (area.readOnly) {
        area.readOnly = false;
        area.style.backgroundColor = "rgba(255,255,255,0.08)";
        area.style.border = "1px solid var(--green)";
        area.focus();
        btn.textContent = "Guardar";
    } else {
        area.readOnly = true;
        area.style.backgroundColor = "";
        area.style.border = "1px solid var(--border)";
        btn.textContent = "Editar";
    }
}

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
