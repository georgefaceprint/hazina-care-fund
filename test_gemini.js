const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
    try {
        const genAI = new GoogleGenerativeAI("AIzaSyD8zWheYt-GwnUS4MaYQ7pMoIrxmfXYGM0");
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const prompt = `Generate exactly 12 NEW unique Q&A pairs about Hazina.
Return ONLY a valid JSON array, no markdown:
[
  { "question": "...", "answer": "..." }
]`;
        
        console.log("Calling Gemini...");
        const result = await model.generateContent(prompt);
        console.log("Success!");
        console.log(result.response.text());
    } catch (err) {
        console.error("ERROR:", err.message);
    }
}
test();
