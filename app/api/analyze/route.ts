// app/api/analyze/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a brutually honest food safety expert. 
          Analyze the OCR text from a food label. 
          
          Identify ingredients that are misleading or unhealthy:
          1. HIDDEN Sugars (e.g., Maltodextrin, Dextrose, High Fructose Corn Syrup, Agave, Fruit Juice Concentrate).
          2. Sneaky Additives (e.g., Red 40, Yellow 5, E-numbers like E150, Nitrates, Carrageenan).
          3. "Clean Label" Tricks (e.g., "Yeast Extract" is often hidden MSG).

          Ignore standard "Sugar" if it's obvious, but flag it if it's the #1 ingredient.
          
          Return ONLY a JSON object with a single key 'bad_ingredients' containing an array of the exact strings found.
          Example: { "bad_ingredients": ["Maltodextrin", "Red 40"] }`
        },
        { role: "user", content: text }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({ error: "Failed to analyze" }, { status: 500 });
  }
}