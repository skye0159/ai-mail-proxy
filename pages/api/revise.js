export default async function handler(req, res) {

  // ========= VERSION (nur für Debug – kannst du später entfernen) =========
  const VERSION = "v5-pages-api-parser-ok";

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
    return res
      .status(405)
      .json({ error: "Method not allowed. Use POST.", version: VERSION });
  }

  try {
    const { prompt_id, email_text, scenario_id } = req.body || {};

    if (!prompt_id || !email_text) {
      return res.status(400).json({
        error: "Missing prompt_id or email_text.",
        version: VERSION
      });
    }

    // ---------- PROMPT MAP ----------
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
      return res.status(400).json({
        error: "Invalid prompt_id.",
        version: VERSION
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY not set.",
        version: VERSION
      });
    }

    const systemPrompt = [
      "You are an AI assistant that revises short workplace emails.",
      "Follow the given instruction strictly.",
      "Do not add or remove factual information.",
      "Return only the revised email text."
    ].join(" ");

    // ---------- OPENAI CALL ----------
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        instructions: systemPrompt,
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
      return res.status(500).json({
        error: "OpenAI request failed.",
        openai_status: response.status,
        details: errText.slice(0, 2000),
        version: VERSION
      });
    }

    const data = await response.json();

    // ---------- ROBUST OUTPUT EXTRACTION ----------
    let revised = "";

    // preferred: output_text
    if (typeof data.output_text === "string" && data.output_text.trim()) {
      revised = data.output_text.trim();
    }

    // fallback: output[].content[].text
    if (!revised && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item?.type === "message" && Array.isArray(item.content)) {
          const part = item.content.find(
            c => c?.type === "output_text" && typeof c.text === "string"
          );
          if (part?.text?.trim()) {
            revised = part.text.trim();
            break;
          }
        }
      }
    }

    if (!revised) {
      return res.status(500).json({
        error: "v5: no revised text extracted",
        details: JSON.stringify(data).slice(0, 2000),
        version: VERSION
      });
    }

    // ---------- SUCCESS ----------
    return res.status(200).json({
      revised_email: revised,
      version: VERSION
    });

  } catch (e) {
    return res.status(500).json({
      error: "Server error.",
      details: String(e),
      version: VERSION
    });
  }
}
