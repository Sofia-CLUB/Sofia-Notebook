export default async function handler(req, res) {
  // Дозволяємо запити з Sofia Notebook
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

    const subject = context?.subject || "не вказано";
    const grade = context?.grade || "не вказано";
    const workType = context?.workType || "не вказано";

    const instructions = `
Ти — освітній AI-помічник Sofia Notebook PRO.

Допомагай учителям та учням у навчанні.

Предмет: ${subject}
Клас: ${grade}
Тип роботи: ${workType}

Правила:
- відповідай українською мовою, якщо користувач не попросив іншу;
- пояснюй зрозуміло відповідно до віку учня;
- допомагай з математикою, українською та англійською мовами,
  інформатикою, природничими та іншими шкільними предметами;
- математичні задачі розв'язуй покроково;
- можеш створювати вправи, приклади, тести та пояснення;
- для вчителя можеш допомагати створювати завдання для уроку;
- не вигадуй фактів, якщо не впевнений у відповіді.
`;

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model: "gpt-5-mini",
          instructions: instructions,
          input: message
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Помилка підключення до OpenAI"
      });
    }

    let answer = "";

    if (data.output_text) {
      answer = data.output_text;
    }

    if (!answer && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (!Array.isArray(item.content)) continue;

        for (const content of item.content) {
          if (
            content.type === "output_text" &&
            content.text
          ) {
            answer += content.text;
          }
        }
      }
    }

    if (!answer) {
      answer = "AI не повернув текстову відповідь.";
    }

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
