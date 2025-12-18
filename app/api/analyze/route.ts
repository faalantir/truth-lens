// app/api/analyze/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    // The Prompt: We ask GPT to find the "lies" in the text
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a food safety expert. Analyze the provided text (which is a food label). 
          Identify ingredients that are:
          1. Hidden sugars (e.g., dextrose, high fructose corn syrup, maltodextrin).
          2. Artificial preservatives or additives that are controversial (e.g., Red 40, Nitrates).
          
          Return ONLY a JSON object with a single key 'bad_ingredients' containing an array of the exact words found in the text.
          Example: { "bad_ingredients": ["Dextrose", "Red 40"] }
          Do not include markdown formatting.`
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