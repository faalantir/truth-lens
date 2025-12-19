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
          content: `You are a food safety expert. Analyze the OCR text from a food label.
          
          TASK: Identify ONLY highly processed or deceptive ingredients.
          
          1. FLAG THESE (The Villains):
             - High Fructose Corn Syrup, Corn Syrup, Dextrose, Maltodextrin, Sucralose, Aspartame.
             - Red 40, Blue 1, Yellow 5, Titanium Dioxide.
             - Sodium Nitrite, Potassium Bromate, Hydrogenated Oils.
             - "Flavor" or "Artificial Flavor" (if vague).

          2. IGNORE THESE (The Heroes - DO NOT FLAG):
             - Sugar (if it's just "Sugar" or "Cane Sugar", ignore it for this demo).
             - Salt, Sea Salt, Spices.
             - Dates, Honey, Maple Syrup, Fruit Puree.
             - Flour, Oats, Wheat, Milk, Cream, Eggs.
             - Vitamins (e.g., Ascorbic Acid, Riboflavin).

          Return ONLY a JSON object with a single key 'bad_ingredients'.
          If no villains are found, return empty array [].
          Example: { "bad_ingredients": ["Red 40", "HFCS"] }`
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