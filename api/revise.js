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

    // --- New prompts (kept under keys P1..P6) ---
    const PROMPTS = {
      P1: `
Rewrite the email to be shorter and more concise.
Remove redundancy, filler words, and non-essential phrasing while keeping all substantive information unchanged.
Politeness formulas, courtesy phrases, and softening language may be removed if they do not carry essential meaning.
Do not change the structure, paragraphing, or order of the text.
      `.trim(),

      P2: `
Improve the clarity and structure of the email (e.g., clearer paragraphs or flow) without changing the content or meaning. You can add bullet points or lines or use spaces between the lines. Do not use bolding or **. Make sure the output is different than the input, change bullet points or style of structure.
      `.trim(),

      P3: `
Rewrite the email in a formal, professional, and workplace-appropriate tone.
Maintain a neutral, distant, and objective style, avoiding friendliness, warmth, or personal engagement.
Do not increase assertiveness or emphasis; the goal is formality and correctness, not confidence or persuasion.
Use standard professional greetings and farewells.
Keep all content, structure, paragraphing, and order unchanged.
      `.trim(),

      P4: `
Carefully review the email for potential errors, ambiguities, or imprecise wording.
Revise the text to eliminate uncertainty, clearly state figures and assessments, and ensure that the information cannot be misunderstood, without adding any new information.
Do not change the structure, paragraphing, or order of the text.
      `.trim(),

      P5: `
Rewrite the email so that it sounds clearly confident and self-assured.
Use decisive and assertive wording, reduce hedging expressions (e.g., "around", "currently considered", "at this stage"), and state assessments more directly, while keeping all factual information unchanged.
Remove or neutralize politeness markers, courtesy phrases, and softening language where they weaken confidence or authority.
Politeness should not be preserved if it conflicts with a confident, direct tone.
Do not change the structure, paragraphing, or order of the text.
      `.trim(),

      P6: `
Rewrite the email to sound more polite and friendly in tone.
Use courteous and respectful language, such as a friendly opening and closing.
If there are already polite expressions in the original email, refine them subtly and add a small number of appropriate formalities.
Soften direct phrasing where appropriate, while keeping the main content unchanged.
Do not change the structure, paragraphing, or order of the text.
      `.trim(),
    };

    const instruction = PROMPTS[prompt_id];
    if (!instruction) {
      return res.status(400).json({ error: "Invalid prompt_id." });
    }

    // --- Slim system prompt (guardrails only; style is controlled by the selected prompt) ---
    const system = [
      "You revise short workplace emails.",
      "Follow the given instruction.",
      "",
      "Do not add new factual information or change the meaning of any statement.",
      "Stylistic tone (e.g., politeness, confidence, formality) may be freely adjusted to fulfill the instruction and does not count as factual content.",
      "",
      "Return ONLY the revised email text. No explanations."
    ].join(" ");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
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
              `EMAIL:\n${email_text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res
        .status(500)
        .json({ error: "OpenAI request failed.", details: errText.slice(0, 2000) });
    }

    const data = await response.json();

    const revised =
      (typeof data.output_text === "string" && data.output_text.trim()) ||
      (data.output?.[0]?.content || []).find((c) => c.type === "output_text")?.text ||
      "";

    if (!revised) {
      return res.status(500).json({
        error: "No revised text returned.",
        details: JSON.stringify(data).slice(0, 1500),
      });
    }

    return res.status(200).json({
      revised_email: revised,
      used_prompt_id: prompt_id,
      used_instruction: instruction,
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
