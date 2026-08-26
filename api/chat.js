const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";

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

    const model = process.env.GEMINI_TEXT_MODEL || DEFAULT_TEXT_MODEL;
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
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_) {
      return res.status(502).json({ error: "Gemini повернув некоректну відповідь" });
    }

    if (!response.ok) {
      console.error("Gemini text API error:", response.status, data);
      return res.status(response.status).json({
        error: data?.error?.message || `Gemini: помилка ${response.status}`
      });
    }

    const reply = readGeminiText(data);
    if (!reply) {
      return res.status(502).json({ error: "Gemini не повернув текстову відповідь" });
    }

    return res.status(200).json({
      reply,
      provider: "gemini",
      model
    });
  } catch (error) {
    console.error("Gemini handler error:", error);
    return res.status(500).json({
      error: error?.message || "Не вдалося отримати відповідь від ШІ"
    });
  }
}
