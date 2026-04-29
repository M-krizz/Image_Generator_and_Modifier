const { GoogleGenAI } = require("@google/genai");
const sharp = require("sharp");

let ai = null;

/** Initialise the Gemini client (call once at startup) */
function init() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    console.error("⚠️  GEMINI_API_KEY is not set. Add it to your .env file.");
    return;
  }
  ai = new GoogleGenAI({ apiKey });
  console.log("✅ Gemini client initialised");
  console.log(`   Model: ${process.env.GEMINI_MODEL || "gemini-2.5-flash-image"}`);
  console.log(`   Max variants: ${process.env.MAX_VARIANTS || 1}`);
  console.log(`   Rate limit delay: ${process.env.RATE_LIMIT_DELAY_MS || 5000}ms`);
}

/**
 * Send a product image + prompt to Gemini and receive a generated image back.
 * Includes rate-limit-aware retry with exponential backoff for free tier.
 */
async function generateImage(imageBuffer, mimeType, prompt) {
  if (!ai) throw new Error("Gemini client not initialised. Check API key.");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
  const base64Image = imageBuffer.toString("base64");
  const maxRetries = 3;
  const baseDelay = parseInt(process.env.RATE_LIMIT_DELAY_MS, 10) || 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   [Gemini] Attempt ${attempt}/${maxRetries} with model: ${model}`);

      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      // Extract the generated image from the response
      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) {
        throw new Error("Gemini returned no content. The request may have been filtered.");
      }

      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          const rawBuffer = Buffer.from(part.inlineData.data, "base64");
          // Remove watermark and return cleaned image
          const cleanBuffer = await removeWatermark(rawBuffer);
          console.log(`   [Gemini] ✅ Image generated successfully (${cleanBuffer.length} bytes)`);
          return {
            buffer: cleanBuffer,
            mimeType: "image/png",
          };
        }
      }

      throw new Error("Gemini response did not contain an image.");

    } catch (err) {
      const errMsg = err.message || String(err);
      const isRateLimit = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED");
      const isRetryable = isRateLimit || errMsg.includes("503") || errMsg.includes("UNAVAILABLE");

      if (isRetryable && attempt < maxRetries) {
        // Extract retry delay from error if available, otherwise use exponential backoff
        const retryMatch = errMsg.match(/retry in (\d+\.?\d*)/i);
        const serverDelay = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) : 0;
        const delay = Math.max(serverDelay, baseDelay * Math.pow(2, attempt - 1));
        
        console.log(`   [Gemini] ⏳ Rate limited. Waiting ${Math.round(delay / 1000)}s before retry...`);
        await sleep(delay);
        continue;
      }

      // Non-retryable or final attempt
      if (isRateLimit) {
        throw new Error(
          "API rate limit exceeded. Free tier has per-minute limits. " +
          "Please wait 60 seconds and try again, or enable billing at https://ai.dev/projects"
        );
      }
      throw err;
    }
  }
}

/**
 * Remove visible watermarks from generated images.
 * Crops the bottom 4% of the image where AI watermarks typically appear.
 */
async function removeWatermark(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;

    if (!width || !height || height < 100) return imageBuffer;

    // Crop bottom 4% where watermarks usually sit
    const cropHeight = Math.max(Math.floor(height * 0.04), 16);
    const newHeight = height - cropHeight;

    return sharp(imageBuffer)
      .extract({ left: 0, top: 0, width, height: newHeight })
      .png({ quality: 95 })
      .toBuffer();
  } catch {
    // If watermark removal fails, return original
    return imageBuffer;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { init, generateImage };
