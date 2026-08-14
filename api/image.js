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
    const { prompt, size = "1024x1024" } = req.body || {};

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        error: "Опишіть зображення"
      });
    }

    const apiKey = process.env.POLLINATIONS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "У Vercel не знайдено POLLINATIONS_API_KEY"
      });
    }

    const enhancedPrompt = `
Навчальна ілюстрація для уроку.
Чітке, якісне, зрозуміле зображення.
Підходить для використання в школі.
Без водяних знаків.

${prompt.trim()}
`;

    const pollinationsResponse = await fetch(
      "https://gen.pollinations.ai/v1/images/generations",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model: "flux",
          prompt: enhancedPrompt,
          size: size,
          n: 1,
          response_format: "url",
          safe: true
        })
      }
    );

    const contentType =
      pollinationsResponse.headers.get("content-type") || "";

    const raw = await pollinationsResponse.text();

    if (!pollinationsResponse.ok) {
      console.error(
        "Pollinations API error:",
        pollinationsResponse.status,
        raw
      );

      let message =
        "Не вдалося створити зображення. Код " +
        pollinationsResponse.status;

      try {
        const parsed = JSON.parse(raw);

        message =
          parsed?.error?.message ||
          parsed?.error ||
          message;
      } catch (e) {}

      return res.status(pollinationsResponse.status).json({
        error: message
      });
    }

    let data;

    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("Pollinations повернув не JSON:", raw);

      return res.status(500).json({
        error: "Сервіс генерації повернув некоректну відповідь"
      });
    }

    const imageUrl =
      data?.data?.[0]?.url ||
      data?.url ||
      "";

    if (!imageUrl) {
      console.error(
        "Pollinations response without URL:",
        data
      );

      return res.status(500).json({
        error: "Pollinations не повернув адресу зображення"
      });
    }

    return res.status(200).json({
      success: true,
      url: imageUrl
    });

  } catch (error) {
    console.error("IMAGE API ERROR:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Не вдалося створити зображення"
    });
  }
}
