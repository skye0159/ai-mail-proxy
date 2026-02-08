export default async function handler(req, res) {

  // ---------- CORS ----------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { prompt_id, email_text, scenario_id } = req.body || {};

    if (!prompt_id || !email_text) {
      return res.status(400).json({ error: "Missing prompt_id or email_text." });
    }

    const PROMPTS = {
      P1: "Rewrite the email to be shorter and more concise while keeping all key information unchanged. Do not change the structure, paragraphing, or order of the text.",
      P2: "Improve the clarity and structure of the email (e.g., clearer paragraphs or flow) without changing the content or meaning.",
      P3: "Rewrite the email in a professional and appropriate tone for the workplace, focusing on formality and professionalism, while keeping the content unchanged. Do not change the structure, paragraphing, or order of the text. Also pay attention to professional greetings and farewells.",
      P4: "Carefully review the email for potential errors, ambiguities, or imprecise wording. Revise the text to eliminate uncertainty, clearly state figures and assessments, and ensure that the information cannot be misunderstood, without adding any new information. Do not change the structure, paragraphing, or order of the text.",
      P5: "Rewrite the email so that it sounds clearly confident and self-assured. Use decisive and assertive wording, reduce hedging expressions (e.g., “around”, “currently considered”, “at this stage”), and state assessments more directly, while keeping all factual information unchanged. Do not change the structure, paragraphing, or order of the text.",
      P6: "Rewrite the email to sound very polite and considerate in tone. Use courteous and respectful language, such as a friendly opening and closing (e.g., a brief polite greeting and a friendly goodbye), and soften direct phrasing where appropriate, while keeping the content unchanged. Do not change the structure, paragraphing, or order of the text."
    };

    const instruction = PROMPTS[prompt_id];
    if (!instruction) {
      return res.status(400).json({ error: "Invalid prompt_id." });
    }

    const system = [
      "You are an AI assistant that revises short workplace emails.",
      "Follow the given instruction exactly.",
      "Do NOT add any new information (facts, numbers, names, assumptions).",
      "Do NOT remove any factual information that is already present.",
      "If the instruction says not to change structure/paragraphing/order, you must keep the SAME line breaks and the SAME sentence order.",
      "Return ONLY the revised email text. No explanations, no bullet points, no headings unless already present."
    ].join(" ");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        instructions: system,
        input: [
          {
            role: "user",
            content:
              `Scenario: ${scenario_id || "unknown"}\n` +
              `Prompt_ID: ${prompt_id}\n` +
              `Instruction: ${instruction}\n\n` +
              `EMAIL:\n${email_text}`
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: "OpenAI request failed.", details: errText.slice(0, 2000) });
    }

    const data = await response.json();

    const revised =
      (typeof data.output_text === "string" && data.output_text.trim()) ||
      (data.output?.[0]?.content || []).find(c => c.type === "output_text")?.text ||
      "";

    if (!revised) {
      return res.status(500).json({ error: "No revised text returned.", details: JSON.stringify(data).slice(0, 1500) });
    }

    // Debug for testing (remove later if you want)
    return res.status(200).json({
      revised_email: revised,
      used_prompt_id: prompt_id,
      used_instruction: instruction
    });

  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
