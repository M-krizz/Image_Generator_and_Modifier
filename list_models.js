require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

async function listModels() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const pager = await ai.models.list({ config: { pageSize: 100 } });
  for await (const model of pager) {
    if (model.name.includes("flash") || model.name.includes("image")) {
      console.log(model.name, "|", model.supportedActions?.join(", ") || "");
    }
  }
}

listModels().catch(console.error);
