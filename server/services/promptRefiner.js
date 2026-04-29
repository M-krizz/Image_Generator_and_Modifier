const { GoogleGenAI } = require("@google/genai");

let ai = null;

function init() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") return;
  ai = new GoogleGenAI({ apiKey });
}

/**
 * Enhance a base prompt using a text-only LLM pass.
 * @param {string} basePrompt
 * @param {string} category
 * @returns {Promise<string>}
 */
async function enhancePrompt(basePrompt, category) {
  if (!ai) init();
  if (!ai) throw new Error("Gemini client not initialised for Prompt Refiner.");

  // We use the flash model for text tasks as it is fast and cheap
  const model = "gemini-2.0-flash";

  const metaPrompt = `You are a professional product photographer and AI prompt engineer.
Your task is to refine the following photography prompt for high-quality image generation.

CATEGORY: ${category}

STRICT RULES:
1. DO NOT change the product description.
2. DO NOT add new objects that are not implied by the context.
3. DO NOT modify the product's shape, color, material, or texture.
4. ONLY improve clarity, realism, lighting, composition, and photography terminology.
5. You MUST preserve the entire "── ABSOLUTE RULES (NON-NEGOTIABLE) ──" section exactly as it is.

BASE PROMPT:
${basePrompt}

Return ONLY the refined prompt text. Do not include any conversational filler or markdown formatting blocks like \`\`\`.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: metaPrompt,
      config: {
        temperature: 0.4, // Keep it relatively deterministic but allow some creative enhancement of lighting/camera
      },
    });

    let refined = response.text || basePrompt;
    
    // Strip markdown if it was returned despite instructions
    if (refined.startsWith("```")) {
      refined = refined.replace(/```.*?\n/, "").replace(/```$/, "").trim();
    }
    
    return refined;
  } catch (err) {
    console.error("Prompt Refiner failed:", err.message);
    // Fallback to the base prompt if enhancement fails
    return basePrompt;
  }
}

module.exports = { enhancePrompt };
