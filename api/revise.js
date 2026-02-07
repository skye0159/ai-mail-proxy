export default async function handler(req, res) {

  // ---------- CORS HEADERS ----------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // ---------- PREFLIGHT ----------
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ---------- POST ONLY ----------
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

    // ---------- OPENAI CALL ----------
    const payload = {
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
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    // ---------- DEBUGGING: return OpenAI status + body on failure ----------
    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI request failed:", response.status, errText);

      return res.status(500).json({
        error: "OpenAI request failed.",
        openai_status: response.status,
        details: errText.slice(0, 2000)
      });
    }

    const data = await response.json();

    // ---------- ROBUST OUTPUT EXTRACTION ----------
    let revised = "";

    // 1) If output_text exists, use it
    if (typeof data.output_text === "string" && data.output_text.trim()) {
      revised = data.output_text.trim();
    }

    // 2) Otherwise, read from data.output[].content[] where type === "output_text"
    if (!revised && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item && item.type === "message" && Array.isArray(item.content)) {
          const part = item.content.find(
            (c) => c && c.type === "output_text" && typeof c.text === "string"
          );
          if (part && part.text && part.text.trim()) {
            revised = part.text.trim();
            break;
          }
        }
      }
    }

    if (!revised) {
      console.error("No revised text returned. Full response:", JSON.stringify(data).slice(0, 4000));
      return res.status(500).json({
        error: "No revised text returned by model.",
        details: JSON.stringify(data).slice(0, 2000)
      });
    }

    return res.status(200).json({ revised_email: revised });

  } catch (e) {
    console.error("Server error:", e);
    return res.status(500).json({ error: "Server error.", details: String(e) });
  }
}
