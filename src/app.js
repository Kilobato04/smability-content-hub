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
    return `<img src="assets/logo_white.png" height="${height}"
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
                headline: src[2]?.headline || aiData.bullets_title || 'Protocolo Técnico',
                
                // PRIORIDAD: Si en el JSON de slides definiste "bullets", úsalos. 
                // Si no, usa los de la IA.
                bullets: src[2]?.bullets || aiData.bullets || ['Dato técnico 1', 'Dato técnico 2']
            },
            {
                type: 'split_map',
                headline: src[3]?.headline || 'Dato Crítico',
                ai_body: postData.datos.datos_hardcoded || aiData.insight_body || '',
                
                // PRIORIDAD: 1. JSON manual (src) | 2. Dato de la IA (postData.datos.metric) | 3. Fallback
                metric: src[3]?.metric || postData.datos.metric || '---', 
                
                metric_label: src[3]?.metric_label || 'Impacto Medido'
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
    const S     = sidepx || 0; // Se calculará dinámicamente en PDF
    const el = document.createElement('div');
    el.className = `slide-preview slide-${slide.type}`;

    // --- FIX DE DIMENSIONAMIENTO PARA EL HUB ---
    if (!isPDF) {
        // En el Hub, forzamos el cuadrado para que no se vea como tira
        el.style.width = '100%';
        el.style.aspectRatio = '1 / 1';
    }

    // 1. APLICAR COLOR ALEATORIO DE SESIÓN
    const sessionBg = _lastEnrichedPost.sessionBg || '#001A4D';
    el.style.backgroundColor = sessionBg;

    // 2. LÓGICA DE IMAGEN (SOLO ANÁLISIS O PDF)
    // Nos aseguramos que la lámina 2 siempre tenga imagen
    const isAnalysisSlide = slide.bg && (slide.bg.includes('analysis') || slide.isAnalysis);
    const bgUrl = isPDF ? bgBase64 : (isAnalysisSlide ? slide.bg : null);

    if (bgUrl) {
        el.style.backgroundImage    = `url(${bgUrl})`;
        el.style.backgroundSize     = 'cover';
        el.style.backgroundPosition = 'center';
    } else {
        el.style.backgroundImage = 'none';
    }

    // 3. FIX PARA PDF: Forzar dimensiones y color
    if (isPDF) {
        el.style.cssText = `
            background-image:${bgUrl ? `url(${bgUrl})` : 'none'};
            background-size:cover; background-position:center;
            background-color:${sessionBg};
            width:${S}px; height:${S}px; aspect-ratio:unset;
            position:relative; display:flex; flex-direction:column;
            justify-content:space-between;
            padding:${Math.round(S * 0.052)}px;
            overflow:hidden; box-sizing:border-box;
            border-radius:0; box-shadow:none;`;
    }

    // 4. ESCALA TIPOGRÁFICA Y ESPACIOS
    const pad = isPDF ? Math.round(S * 0.052) : 56;
    const fs_h3 = isPDF ? Math.round(S * 0.083) : 52;
    const gap = isPDF ? Math.round(S * 0.018) : 14;

    // --- LÓGICA DE OVERLAYS (Nítido en Lámina 2) ---
    const overlayDiv = (bgUrl && !isAnalysisSlide) ? `
        <div style="position:absolute;inset:0;
            background:${slide.type === 'cover_bold' 
                ? 'linear-gradient(160deg,rgba(0,0,0,0.85) 0%,rgba(0,71,171,0.6) 50%,rgba(0,0,0,0.9) 100%)' 
                : 'rgba(0,0,0,0.72)'};
            z-index:1;pointer-events:none;"></div>` : '';

    // --- PREPARACIÓN DE CONTENIDO (Masivo/LinkedIn Like) ---
    let bodyContent = '';

   if (slide.type === 'cover_bold') {
        // AJUSTE: Logo 50% más grande (de 0.050 a 0.075)
        const coverLogoH = isPDF ? Math.round(S * 0.075) : 48;
        bodyContent = `
            <div style="position:absolute; top:${pad}px; right:20px; z-index:10; text-align:right;">
                ${logoImg(coverLogoH, isPDF, 'brightness(0) invert(1)')}
            </div>
            <div style="margin-top: auto;">
                ${slide.cat_tag ? `<div class="status-badge" style="display:inline-block; margin-bottom:${gap}px; background:#39FF14; color:#000; padding:6px 14px; border-radius:100px; font-weight:800; font-size:12px; font-family:'Space Grotesk';">${slide.cat_tag}</div>` : ''}
                <h3 style="font-family:'Space Grotesk'; font-size:${fs_h3}px; font-weight:900; line-height:0.95; color:#fff; text-transform:uppercase; margin:0;">${slide.headline}</h3>
                ${slide.ai_hook ? `<p style="border-left:4px solid #39FF14; padding-left:20px; margin-top:30px; color:#9A9A9A; font-weight:600; font-size:20px; line-height:1.4;">${slide.ai_hook}</p>` : ''}
            </div>`;

   } else if (slide.type === 'data_callout') {
        const deviceCircleSize = isPDF ? Math.round(S * 0.12) : 90;
        const deviceName = slide.device_tag || 'SMAA(m)';
        
        // --- EDITAR TEXTOS AQUÍ ---
        const textoFijoSuperior = "MODELO DE LLUVIA PARA EL VALLE DE MÉXICO"; 
        const etiquetaFichaTecnica = "DATOS CLAVE:"; // Antes "Ficha Técnica"
        
        // Título Dinámico (El que viene del JSON)
        const tituloDinamico = slide.headline || "MAPA CRÍTICO DE LA LLUVIA";

        bodyContent = `
            <div style="text-align:left; width:100%; height:100%; position:relative; display:flex; flex-direction:column;">
                
                <div style="position:absolute; top:0; left:0; z-index:10; max-width:85%;">
                    <p style="font-family:'Space Grotesk'; font-size:12px; color:#FFFFFF; font-weight:800; letter-spacing:2px; margin:0 0 10px 0; text-transform:uppercase;">
                        ${textoFijoSuperior}
                    </p>
                    <h3 style="font-family:'Space Grotesk'; font-size:${fs_h3 * 0.85}px; color:#FFFFFF; font-weight:900; line-height:0.95; margin:0; text-transform:uppercase; letter-spacing:-0.04em; text-shadow: 0 2px 15px rgba(0,0,0,0.6);">
                        ${tituloDinamico}
                    </h3>
                </div>

                <div style="position:absolute; top:-10px; right:12px; text-align:right; z-index:12;">
                    <span style="font-family:'Space Grotesk'; font-size:11px; color:#000; background:#39FF14; padding:3px 10px; font-weight:900; letter-spacing:1px; text-transform:uppercase; border-radius:2px;">
                        ${deviceName}
                    </span>
                </div>

                <div class="device-circle" style="position:absolute; top:15px; right:0; width:${deviceCircleSize}px; height:${deviceCircleSize}px; background:#222; border:2px solid #39FF14; border-radius:50%; display:flex; align-items:center; justify-content:center; overflow:hidden; z-index:11; box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
                    <img src="assets/devices/${(slide.device_tag || 'SMAA').toLowerCase()}.png" style="width:70%; filter: brightness(1.3);" onerror="this.style.display='none'">
                </div>
                
                <div style="flex:1;"></div>

                <div class="tech-specs-box" style="position:absolute; bottom:0; right:-${isPDF ? 0 : 10}px; width:240px; background:rgba(255,255,255,0.96); border-left:8px solid #39FF14; padding:20px; color:#111; z-index:10; box-shadow: -15px 15px 40px rgba(0,0,0,0.15);">
                    <b style="font-family:'Space Grotesk'; font-size:11px; color:#0047AB; text-transform:uppercase; display:block; margin-bottom:8px; letter-spacing:1px;">
                        ${etiquetaFichaTecnica}
                    </b>
                    <p style="font-family:'Inter'; font-size:13px; font-weight:700; line-height:1.4; margin:0; color:#333;">
                        ${(slide.technical_specs || '').replace(/\n/g, '<br>')}
                    </p>
                </div>
            </div>`;

    } else if (slide.type === 'bullets') {
        const bulletItems = (slide.bullets || []).map((b, i) => `
            <div style="display:flex; align-items:flex-start; gap:15px; padding:20px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
                <span style="color:#39FF14; font-family:'Space Grotesk'; font-weight:700;">0${i+1}</span>
                <span style="color:#fff; font-weight:600; font-size:20px;">${b}</span>
            </div>`).join('');
        bodyContent = `<div style="margin-top:60px;"><h3 style="font-size:32px; margin-bottom:30px;">${slide.headline}</h3><div>${bulletItems}</div></div>`;

    } else if (slide.type === 'split_map') {
        bodyContent = `
            <div style="display:flex; flex-direction:column; justify-content:center; height:100%; padding-top:40px;">
                <h3 style="font-size:42px; font-weight:900; color:#fff; margin-bottom:20px; text-transform:uppercase;">${slide.headline}</h3>
                <p style="font-size:20px; color:#F0F0F0; border-left:5px solid #39FF14; padding-left:25px; line-height:1.5; margin-bottom:25px;">${slide.ai_body}</p>
                ${slide.metric ? `<div style="font-size:72px; font-weight:900; color:#39FF14; letter-spacing:-2px;">${slide.metric}</div>` : ''}
            </div>`;

   } else if (slide.type === 'cta_clean') {
        // --- CONFIGURACIÓN DE TEXTOS EDITABLES (Lámina 5) ---
        const tituloCTA = "AIreGPT"; // Texto grande arriba
        const bajadaCTA = "Escanea para activar tus alertas de aire y lluvia."; // Texto debajo del nombre
        const labelBoton = slide.ai_cta_label || "Probar Bot";

        bodyContent = `
            <div style="text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; position:relative;">
                <div style="margin-bottom:30px;">
                    <h2 style="font-family:'Space Grotesk'; font-size:64px; font-weight:900; color:#fff; margin:0; line-height:1;">
                        ${tituloCTA}
                    </h2>
                    <p style="font-family:'Inter'; font-size:18px; color:#39FF14; font-weight:700; margin-top:10px;">
                        ${bajadaCTA}
                    </p>
                </div>

                <div class="qr-container" style="background:#fff; padding:15px; border-radius:12px; margin-bottom:30px; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
                    <img src="assets/qr_airegpt.png" style="width:180px; height:180px;">
                </div>
                
                <div style="background:#39FF14; color:#000; padding:15px 40px; border-radius:100px; font-family:'Space Grotesk'; font-weight:900; text-transform:uppercase; font-size:16px; letter-spacing:1px;">
                    ${labelBoton}
                </div>
            </div>`;
    }

    // --- ENSAMBLAJE FINAL ---
    const isDataCallout = slide.type === 'data_callout';
    const numLabel = `<span style="position:absolute; top:18px; left:24px; font-family:'Space Grotesk'; font-size:11px; font-weight:700; color:rgba(255,255,255,0.5); z-index:10; background:rgba(0,0,0,0.4); padding:3px 8px; border-radius:4px;">0${index + 1} / 0${total}</span>`;
    const greenArrow = (index < total - 1) ? `<div class="green-arrow" style="position:absolute; top:18px; right:24px; color:#39FF14; font-size:24px; z-index:10; font-family:'Space Grotesk'; font-weight:900;">→</div>` : '';

    el.innerHTML = `
        ${overlayDiv}
        ${numLabel}
        ${greenArrow}
        <div style="position:relative; z-index:2; width:100%; height:100%; display:flex; flex-direction:column; justify-content:space-between;">
            <div style="flex:1; display:flex; flex-direction:column; justify-content:${isDataCallout ? 'center' : 'flex-end'};">
                ${bodyContent}
            </div>
            ${isDataCallout ? '' : `<div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:15px; margin-top:20px; font-family:'Space Grotesk'; font-size:11px; color:rgba(255,255,255,0.4); font-weight:700;">
                <span style="color:#39FF14;">●</span> smability.io
            </div>`}
        </div>`;

    // FIX DE CONTRASTE PARA COLORES CLAROS
    const coloresClaros = ['#F5F5F5', '#FFFFFF', '#EAEAEA']; 
    if (coloresClaros.includes(sessionBg)) {
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
    btn.textContent = "⚙️ Optimizando...";
    btn.disabled = true;

    const zip = format === 'png' ? new JSZip() : null;
    const { jsPDF } = window.jspdf;
    
    // PDF Setings: Compresión activa
    const pdf = format === 'pdf' ? new jsPDF({ 
        orientation: 'p', 
        unit: 'px', 
        format: [1080, 1080],
        compress: true // Activa compresión interna de jsPDF
    }) : null;

    try {
        for (let i = 0; i < slides.length; i++) {
            btn.textContent = `Procesando ${i + 1}/${slides.length}...`;
            
            const canvas = await html2canvas(slides[i], {
                scale: 4.0, // SUBIMOS A 4.0 PARA MÁXIMA NITIDEZ (PDF 8MB)
                useCORS: true,
                backgroundColor: _lastEnrichedPost.sessionBg
            });

            // Usamos JPEG Calidad 0.9 para balance peso/nitidez
            const imgData = canvas.toDataURL('image/jpeg', 0.9);

            if (format === 'png') {
                const b64Data = imgData.replace(/^data:image\/jpeg;base64,/, "");
                zip.file(`Smability_Slide_${i + 1}.jpg`, b64Data, {base64: true});
            } else {
                if (i > 0) pdf.addPage([1080, 1080], 'p');
                pdf.addImage(imgData, 'JPEG', 0, 0, 1080, 1080, undefined, 'FAST');
            }
        }

        if (format === 'png') {
            const content = await zip.generateAsync({type:"blob"});
            saveAs(content, `Smability_Post_Abril_${Date.now()}.zip`);
        } else {
            pdf.save(`Smability_Reel_LinkedIn_${Date.now()}.pdf`);
        }

    } catch (err) {
        console.error(err);
        alert("Error en la descarga");
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
