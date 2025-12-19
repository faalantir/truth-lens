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
          // Inside route.ts (Update the content string)
          content: `You are a food safety expert. Analyze the messy OCR text from a food label.
                    Identify ingredients that are:
                    1. Sugars (sugar, syrup, dextrose, fructose, glucose, sucrose, cane).
                    2. Additives (Red 40, Blue 1, Yellow 5, Nitrates, Benzoate).
                    
                    CRITICAL: The text might have typos (e.g., "Suga r", "Hgh Fructose"). 
                    If you see something that LOOKS like a bad ingredient, flag it.
                    
                    Return ONLY a JSON object with 'bad_ingredients'.`
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