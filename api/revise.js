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
     P3: "Rewrite the email in a professional and appropriate tone for the workplace, focusing on formality and professionalism, while keeping the content unchanged. Do not add or remove paragraphs or change line breaks. Also pay attention to professional greetings and farewells.",
P4: "Carefully review the email for potential errors, ambiguities, or imprecise wording. Revise the text to eliminate uncertainty, clearly state figures and assessments, and ensure that the information cannot be misunderstood, without adding any new information. Do not add or remove paragraphs or change line breaks.",
P5: "Rewrite the email so that it sounds clearly confident and self-assured. Use decisive and assertive wording and reduce hedging expressions, while keeping all factual information unchanged. Do not add or remove paragraphs or change line breaks.",
P6: "Rewrite the email to sound very polite and considerate in tone. Use courteous and respectful language (e.g., a brief friendly opening and closing) and soften direct phrasing where appropriate, while keeping the content unchanged. Do not add or remove paragraphs or change line breaks."
    };

    const instruction = PROMPTS[prompt_id];
    if (!instruction) {
      return res.status(400).json({ error: "Invalid prompt_id." });
    }

   const system = [
  "You revise short workplace emails.",
  "Follow the given instruction exactly.",
  "CRITICAL: Do not add any new facts, numbers, names, dates, or assumptions.",
  "CRITICAL: Do not remove any factual information that is already present.",
  "CRITICAL: Keep the meaning of every statement unchanged.",
  "",
  "Formatting rules:",
  "- Only if the instruction explicitly asks to improve structure (P2), you may change paragraphing, reorder sentences, or add/remove line breaks.",
  "- For all other prompts (P1, P3, P4, P5, P6), do NOT add new paragraphs or change the paragraph structure. Keep the number of paragraphs and line breaks the same as the input.",
  "",
  "You MAY rewrite sentence structure, wording, and grammar in all prompts, as long as meaning and facts stay identical.",
  "Return ONLY the revised email text. No explanations."
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
