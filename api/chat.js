const TEXT_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite"
];

function readGeminiText(data) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map(part => typeof part?.text === "string" ? part.text : "")
    .join("")
    .trim();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Дозволено лише POST-запити" });
  }

  try {
    const { message, context } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Введіть запит" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "У Vercel не знайдено GEMINI_API_KEY"
      });
    }

    const subject = context?.subject || "не вказано";
    const grade = context?.grade || "не вказано";
    const workType = context?.workType || "не вказано";
    const systemPrompt = `Ти — освітній AI-помічник Sofia Notebook PRO.

Предмет: ${subject}
Клас: ${grade}
Тип роботи: ${workType}

Правила:
- відповідай українською мовою, якщо користувач не попросив іншу;
- пояснюй відповідно до віку учня;
- математичні задачі розв'язуй покроково;
- допомагай з усіма шкільними предметами;
- можеш створювати вправи, картки, тести, приклади, переклади та пояснення;
- точно виконуй указаний користувачем формат відповіді;
- якщо попросять повернути лише JSON або рядки певного формату, не додавай markdown, пояснень чи вступу;
- відповідай чітко й без зайвої води.`;

    const configuredModel = process.env.GEMINI_TEXT_MODEL;
    const models = configuredModel
      ? [configuredModel, ...TEXT_MODELS.filter(model => model !== configuredModel)]
      : TEXT_MODELS;
    const failures = [];

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              role: "system",
              parts: [{ text: systemPrompt }]
            },
            contents: [{
              role: "user",
              parts: [{ text: String(message).trim() }]
            }],
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 2048
            }
          })
        });

        const raw = await response.text();
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}

        if (!response.ok) {
          const reason = data?.error?.message || `помилка ${response.status}`;
          failures.push(`${model}: ${reason}`);
          console.error("Gemini text API error:", model, response.status, data);
          continue;
        }

        const reply = readGeminiText(data);
        if (!reply) {
          failures.push(`${model}: порожня відповідь`);
          continue;
        }

        return res.status(200).json({
          reply,
          provider: "gemini",
          model
        });
      } catch (error) {
        failures.push(`${model}: ${error?.message || "помилка мережі"}`);
      }
    }

    return res.status(503).json({
      error: "Gemini тимчасово не зміг відповісти. Спробуйте ще раз через хвилину.",
      details: failures
    });
  } catch (error) {
    console.error("Gemini handler error:", error);
    return res.status(500).json({
      error: error?.message || "Не вдалося отримати відповідь від ШІ"
    });
  }
}
