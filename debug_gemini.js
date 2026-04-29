require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
  
  console.log(`Testing: ${model}`);
  console.log("Sending single request...\n");

  const img = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [
        { text: "Place this product on an elegant wooden table with soft studio lighting. Keep the product exactly as-is." },
        { inlineData: { mimeType: "image/png", data: img } }
      ]}],
      config: { responseModalities: ["TEXT", "IMAGE"] },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const hasImage = parts.some(p => p.inlineData);
    
    if (hasImage) {
      const imgPart = parts.find(p => p.inlineData);
      console.log("✅ IMAGE GENERATED!");
      console.log(`   Type: ${imgPart.inlineData.mimeType}`);
      console.log(`   Base64 size: ${imgPart.inlineData.data?.length} chars`);
      console.log("\n   >>> Free tier is WORKING! Your system is ready. <<<");
    } else {
      console.log("Got response but no image. Parts:", parts.map(p => p.text ? "text" : "other"));
    }
  } catch (err) {
    const msg = err.message || "";
    if (msg.includes("429")) {
      // Extract retry time
      const match = msg.match(/retry in (\d+\.?\d*)/i);
      const wait = match ? Math.ceil(parseFloat(match[1])) : 60;
      console.log(`⏳ Still rate limited. Wait ${wait} seconds and run this again.`);
    } else {
      console.log("Error:", msg.slice(0, 300));
    }
  }
}

test();
