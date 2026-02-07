export default async function handler(req, res) {

  // ---------- CORS HEADERS (MUSS GANZ OBEN STEHEN) ----------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // ---------- HANDLE PREFLIGHT (OPTIONS) ----------
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ---------- ALLOW ONLY POST AFTER PREFLIGHT ----------
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { prompt_id, email_text, scenario_id } = req.body || {};

    if (!prompt_id || !email_text) {
      return res.status(400).json({ error: "Missing prompt_id or email_text." });
    }

    // Map Prompt_IDs to instructions
    const PROMPTS = {
      P1:
        "Rewrite the email to be shorter and more concise while keeping all key information unchanged. Do not change the structure, paragraphing, or order of the text.",
      P2:
        "Improve the clarity and structure of the email (e.g., clearer paragraphs or flow) without changing the content or meaning.",
      P3:
        "Rewrite the email in a professional and appropriate tone for the workplace, focusing on formality and professionalism, while keeping the content unchanged. Do not change the structure, paragraphing, or order of the text. Also pay attention to professional greetings and farewells.",
      P4:
        "Carefully review the email for potential errors, ambiguities, or imprecise wording. Revise the text to eliminate uncertainty, clearly state figures and assessments, and ensure that the information cannot be misunderstood, without adding any new information. Do not change the structure, paragraphing, or order of the text.",
      P5:
        "Rewrite the email so that it sounds clearly confident and self-assured. Use decisive and assertive wording, reduce hedging expressions (e.g., “around”, “currently considered”, “at this stage”), and state assessments more directly, while keeping all factual information unchanged. Do not change the structure, paragraphing, or order of the text.",
      P6:
        "Rewrite the email to sound very polite and considerate in tone. Use courteous and respectful language, such as a friendly opening and closing (e.g., a brief polite greeting and a friendly goodbye), and soften direct phrasing where appropriate, while keeping the content unchanged. Do not change the structure, paragraphing, or order of the text."
    };

    const instruction = PROMPTS[prompt_id];
    if (!instruction) {
      return res.status(400).json({ error: "Invalid prompt_id." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not set in Vercel env vars." });
    }

    const system = [
      "You are an AI assistant that helps revise short workplace emails.",
      "Revise the provided email strictly according to the given instruction.",
      "Do not add any new information, facts, numbers, names, or assumptions.",
      "Do not remove factual information that is already present.",
      "Return only the revised email text. Do not add explanations or comments."
    ].join(" ");

    // ⚠️ EMPFEHLUNG: stabiles Modell für Tests
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
      return res.status(500).json({ error: "OpenAI request failed.", details: errText });
    }

    const data = await response.json();
    const revised = data.output_text;

    if (!revised || typeof revised !== "string") {
      return res.status(500).json({ error: "No output_text returned by model." });
    }

    return res.status(200).json({ revised_email: revised });

  } catch (e) {
    return res.status(500).json({ error: "Server error.", details: String(e) });
  }
}
