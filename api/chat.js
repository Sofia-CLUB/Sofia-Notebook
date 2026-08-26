export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Дозволено лише POST-запити"
    });
  }

  try {
    const { message, context } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Введіть запит"
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "У Vercel не знайдено GROQ_API_KEY"
      });
    }

    const subject = context?.subject || "не вказано";
    const grade = context?.grade || "не вказано";
    const workType = context?.workType || "не вказано";

    const systemPrompt = `
Ти — освітній AI-помічник Sofia Notebook PRO.

Допомагай учителям та учням у навчанні.

Предмет: ${subject}
Клас: ${grade}
Тип роботи: ${workType}

Правила:
- відповідай українською мовою, якщо користувач не попросив іншу;
- пояснюй відповідно до віку учня;
- математичні задачі розв'язуй покроково;
- допомагай з математикою, українською та англійською мовами,
  інформатикою, природничими та іншими шкільними предметами;
- можеш створювати вправи, тести, приклади та пояснення;
- відповідай чітко й без зайвої води.
`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.GROQ_TEXT_MODEL || "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: message
            }
          ],
          temperature: 0.4,
          max_tokens: 1200
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Помилка підключення до Groq"
      });
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      "AI не повернув текстову відповідь.";

    return res.status(200).json({
      reply: answer
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Не вдалося отримати відповідь від AI"
    });
  }
}
