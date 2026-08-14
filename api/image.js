export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Дозволено лише POST-запити" });
  }

  try {
    const { prompt, size = "1024x1024" } = req.body || {};

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Опишіть зображення" });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "У Vercel не знайдено GEMINI_API_KEY"
      });
    }

    const sizeMap = {
      "512x512": { aspectRatio: "1:1", imageSize: "512" },
      "1024x1024": { aspectRatio: "1:1", imageSize: "1K" },
      "1024x768": { aspectRatio: "4:3", imageSize: "1K" },
      "768x1024": { aspectRatio: "3:4", imageSize: "1K" }
    };

    const imageConfig = sizeMap[size] || sizeMap["1024x1024"];

    const enhancedPrompt = `
Створи якісну навчальну ілюстрацію для використання в школі.
Зображення має бути чітким, зрозумілим, охайним і придатним для демонстрації на інтерактивній дошці.
Якщо потрібні текстові підписи — використовуй українську мову.
Без сторонніх логотипів і без декоративних водяних знаків.

Запит користувача:
${prompt.trim()}
`;

    const model =
      process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: enhancedPrompt }]
            }
          ],
          generationConfig: {
            responseModalities: ["IMAGE"],
            responseFormat: {
              image: {
                aspectRatio: imageConfig.aspectRatio,
                imageSize: imageConfig.imageSize
              }
            }
          }
        })
      }
    );

    const raw = await geminiResponse.text();

    if (!geminiResponse.ok) {
      console.error(
        "Gemini image API error:",
        geminiResponse.status,
        raw
      );

      let message =
        "Gemini не зміг створити зображення. Код " +
        geminiResponse.status;

      try {
        const parsed = JSON.parse(raw);
        message =
          parsed?.error?.message ||
          parsed?.message ||
          message;
      } catch (e) {}

      return res.status(geminiResponse.status).json({
        error: message,
        provider: "gemini",
        status: geminiResponse.status
      });
    }

    let data;

    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("Gemini повернув не JSON:", raw);

      return res.status(500).json({
        error: "Gemini повернув некоректну відповідь"
      });
    }

    const parts =
      data?.candidates?.[0]?.content?.parts || [];

    const imagePart = parts.find(
      part => part?.inlineData?.data || part?.inline_data?.data
    );

    const inlineData =
      imagePart?.inlineData ||
      imagePart?.inline_data;

    if (!inlineData?.data) {
      console.error(
        "Gemini response without image:",
        JSON.stringify(data)
      );

      const textPart =
        parts.find(part => part?.text)?.text || "";

      return res.status(500).json({
        error:
          textPart ||
          "Gemini відповів, але не повернув зображення",
        provider: "gemini"
      });
    }

    const mimeType =
      inlineData.mimeType ||
      inlineData.mime_type ||
      "image/png";

    return res.status(200).json({
      success: true,
      provider: "gemini",
      model,
      b64_json: inlineData.data,
      mime_type: mimeType
    });

  } catch (error) {
    console.error("GEMINI IMAGE API ERROR:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Не вдалося створити зображення",
      provider: "gemini"
    });
  }
}
