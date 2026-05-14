import Anthropic from "@anthropic-ai/sdk";
import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";

// Configura fal.ai
fal.config({ credentials: process.env.FAL_API_KEY });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── CONTEXTO DE MARCA ───────────────────────────────────────────
const BRAND_CONTEXT = `
Eres el creador de contenido de FiestaGo, el primer marketplace 
especializado en proveedores de eventos en España. Lanzamos el 10 de junio de 2026.

TONO: cercano, moderno, aspiracional. Nunca corporativo.
AUDIENCIA INSTAGRAM: proveedores de eventos y organizadores en España.
AUDIENCIA TIKTOK: parejas y familias organizando bodas, comuniones o celebraciones.
CTA: siempre mencionar fiestago.es o el lanzamiento del 10 de junio.

HASHTAGS INSTAGRAM: #bodas2026 #fotografodebodas #cateringbodas 
#djbodas #eventosespana #bodasenespaña #organizarboda #fiestagoes

HASHTAGS TIKTOK: #bodas #wedding #organizarboda #eventosespana #fiestagoes

RESTRICCIONES:
- Máximo 3 emojis por post
- Nunca mencionar precios de suscripción
- Siempre incluir la fecha 10 de junio o cuenta atrás
- Copy de Instagram: máximo 5 líneas
- Guión TikTok: máximo 30 segundos de voz en off
`;

// ─── TIPOS DE CONTENIDO ──────────────────────────────────────────
const CONTENT_TYPES = {
  inspiracion: {
    copyPrompt: "Post de inspiración para organizadores de eventos. Imagen de boda o celebración elegante. Genera copy para Instagram.",
    imagePrompt: "Elegant Spanish wedding reception, golden hour lighting, floral centerpieces, soft bokeh background, warm tones, photorealistic, professional wedding photography, 4k, no people visible",
    videoPrompt: "Cinematic slow motion elegant wedding table decoration, candles flickering, rose petals, golden hour warm light, luxury event, 4k",
    platform: "Instagram",
  },
  proveedor: {
    copyPrompt: "Post presentando a un nuevo proveedor que se ha unido a FiestaGo antes del lanzamiento. Genera copy para Instagram con placeholder [CIUDAD], [CATEGORÍA] y [NOMBRE].",
    imagePrompt: "Professional event vendor at work in Spain, warm natural lighting, authentic moment, elegant setting, photorealistic, 4k",
    videoPrompt: "Professional photographer at elegant Spanish wedding, candid moment, warm golden light, cinematic, 4k",
    platform: "Instagram",
  },
  behindthescenes: {
    copyPrompt: "Post de behind the scenes mostrando que estamos construyendo FiestaGo. Cuenta atrás al 10 de junio. Tono humano y cercano.",
    imagePrompt: "Modern minimalist startup workspace, laptop with elegant dashboard UI, coffee cup, notebook, soft natural light, clean aesthetic, photorealistic",
    videoPrompt: "Time lapse of modern workspace, hands typing on laptop, coffee steam, warm morning light, productive atmosphere, cinematic",
    platform: "Instagram",
  },
  tiktok_problema: {
    copyPrompt: "Guión de voz en off para TikTok de 25 segundos explicando el problema de organizar eventos en España y cómo FiestaGo lo soluciona. Incluye también el texto que aparecería en pantalla (máximo 5 frases cortas).",
    imagePrompt: "Stressed person looking at multiple phone screens and laptop, event planning chaos, frustrated expression, modern apartment, photorealistic",
    videoPrompt: "Person scrolling phone frustrated, multiple apps open, overwhelmed with event planning, modern Spanish apartment, cinematic 4k",
    platform: "TikTok",
  },
  tiktok_cuentaatras: {
    copyPrompt: "Guión de voz en off para TikTok de 20 segundos con cuenta atrás al lanzamiento de FiestaGo el 10 de junio. Emocionante y con energía.",
    imagePrompt: "Elegant countdown calendar with June 10 circled, wedding elements around it, champagne glasses, flowers, warm lighting, photorealistic",
    videoPrompt: "Elegant calendar pages flipping to June 10, wedding decorations, champagne bubbles, celebratory atmosphere, cinematic slow motion",
    platform: "TikTok",
  },
};

// ─── GENERAR COPY ────────────────────────────────────────────────
async function generateCopy(type) {
  const contentType = CONTENT_TYPES[type];
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: `${BRAND_CONTEXT}\n\nGenera el siguiente contenido:\n${contentType.copyPrompt}\n\nDevuelve SOLO el copy listo para publicar, con hashtags al final. Sin explicaciones adicionales.`
    }]
  });
  return response.content[0].text;
}

// ─── GENERAR IMAGEN ──────────────────────────────────────────────
async function generateImage(type, outputPath) {
  const prompt = CONTENT_TYPES[type].imagePrompt;
  console.log(`🎨 Generando imagen para: ${type}`);
  
  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt,
      image_size: type.startsWith("tiktok") ? "portrait_16_9" : "portrait_4_3",
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: true,
    },
  });

  const imageUrl = result.data.images[0].url;
  const imageResponse = await fetch(imageUrl);
  const buffer = await imageResponse.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  console.log(`✅ Imagen guardada: ${outputPath}`);
}

// ─── GENERAR VÍDEO ───────────────────────────────────────────────
async function generateVideo(type, outputPath) {
  const prompt = CONTENT_TYPES[type].videoPrompt;
  console.log(`🎬 Generando vídeo para: ${type}`);

  const result = await fal.subscribe("fal-ai/kling-video/v1.6/standard/text-to-video", {
    input: {
      prompt,
      duration: "5",
      aspect_ratio: type.startsWith("tiktok") ? "9:16" : "16:9",
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        console.log(`   ⏳ Generando vídeo... ${update.logs?.slice(-1)[0]?.message || ''}`);
      }
    },
  });

  const videoUrl = result.data.video.url;
  const videoResponse = await fetch(videoUrl);
  const buffer = await videoResponse.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  console.log(`✅ Vídeo guardado: ${outputPath}`);
}

// ─── AGENTE PRINCIPAL ────────────────────────────────────────────
async function generateContent(type, date) {
  // Crear carpeta de salida
  const dateStr = date || new Date().toISOString().split('T')[0];
  const outputDir = path.join('content', dateStr, type);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n🚀 Generando contenido: ${type} · ${dateStr}`);
  console.log('─'.repeat(50));

  // 1. Copy
  console.log('📝 Generando copy...');
  const copy = await generateCopy(type);
  fs.writeFileSync(path.join(outputDir, 'copy.md'), copy);
  console.log('✅ Copy generado');

  // 2. Imagen
  await generateImage(type, path.join(outputDir, 'imagen.jpg'));

  // 3. Vídeo
  await generateVideo(type, path.join(outputDir, 'video.mp4'));

  // 4. Resumen
  const summary = `# Contenido FiestaGo · ${type} · ${dateStr}

**Plataforma:** ${CONTENT_TYPES[type].platform}
**Archivos generados:**
- copy.md → copy listo para publicar
- imagen.jpg → imagen para el post
- video.mp4 → vídeo corto (5 segundos)

**Hora recomendada de publicación:**
${type.startsWith('tiktok') ? '18:00h' : type === 'inspiracion' ? '19:00h' : '12:00h'}
`;
  fs.writeFileSync(path.join(outputDir, 'README.md'), summary);

  console.log(`\n✨ Contenido completo en: ${outputDir}`);
}

// ─── SEMANA COMPLETA ─────────────────────────────────────────────
async function generateWeek(startDate) {
  const types = [
    { day: 0, type: 'inspiracion' },
    { day: 0, type: 'tiktok_problema' },
    { day: 1, type: 'proveedor' },
    { day: 2, type: 'inspiracion' },
    { day: 2, type: 'tiktok_cuentaatras' },
    { day: 3, type: 'proveedor' },
    { day: 4, type: 'behindthescenes' },
    { day: 4, type: 'tiktok_cuentaatras' },
    { day: 5, type: 'inspiracion' },
  ];

  const base = new Date(startDate);
  for (const item of types) {
    const date = new Date(base);
    date.setDate(base.getDate() + item.day);
    const dateStr = date.toISOString().split('T')[0];
    await generateContent(item.type, dateStr);
  }
  console.log('\n🎉 Semana completa generada en /content');
}

// ─── CLI ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const command = args[0];

if (command === 'week') {
  const startDate = args[1] || new Date().toISOString().split('T')[0];
  generateWeek(startDate);
} else if (command === 'single') {
  const type = args[1];
  const date = args[2] || new Date().toISOString().split('T')[0];
  if (!CONTENT_TYPES[type]) {
    console.log('Tipos disponibles:', Object.keys(CONTENT_TYPES).join(', '));
  } else {
    generateContent(type, date);
  }
} else {
  console.log(`
FiestaGo Content Agent 🎉

Uso:
  node scripts/content-agent.mjs week 2026-05-19
  → Genera toda la semana desde esa fecha

  node scripts/content-agent.mjs single inspiracion 2026-05-19
  → Genera un contenido específico

Tipos disponibles:
  ${Object.keys(CONTENT_TYPES).join(', ')}
  `);
}
