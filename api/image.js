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
      "512x512":  { aspect_ratio: "1:1", image_size: "512" },
      "1024x1024": { aspect_ratio: "1:1", image_size: "1K" },
      "1024x768": { aspect_ratio: "4:3", image_size: "1K" },
      "768x1024": { aspect_ratio: "3:4", image_size: "1K" }
    };

    const fmt = sizeMap[size] || sizeMap["1024x1024"];

    const enhancedPrompt = `
Створи якісну навчальну ілюстрацію для використання в школі.
Зображення має бути чітким, зрозумілим, охайним і придатним для демонстрації на інтерактивній дошці.
Якщо потрібні текстові підписи — використовуй українську мову.
Без сторонніх логотипів і декоративних водяних знаків.

Запит користувача:
${prompt.trim()}
`;

    const model =
      process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model,
          input: [
            {
              type: "text",
              text: enhancedPrompt
            }
          ],
          response_format: {
            type: "image",
            mime_type: "image/png",
            aspect_ratio: fmt.aspect_ratio,
            image_size: fmt.image_size
          }
        })
      }
    );

    const raw = await response.text();

    if (!response.ok) {
      console.error("Gemini image error:", response.status, raw);

      let message = `Gemini не зміг створити зображення. Код ${response.status}`;

      try {
        const parsed = JSON.parse(raw);
        message =
          parsed?.error?.message ||
          parsed?.message ||
          message;
      } catch (e) {}

      return res.status(response.status).json({
        error: message,
        provider: "gemini",
        status: response.status
      });
    }

    let data;

    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("Gemini повернув не JSON:", raw);
      return res.status(500).json({
        error: "Gemini повернув некоректну відповідь",
        provider: "gemini"
      });
    }

    function findImageBlock(value, seen = new Set()) {
      if (!value || typeof value !== "object" || seen.has(value)) return null;
      seen.add(value);

      if (
        typeof value.data === "string" &&
        value.data.length > 100 &&
        (
          value.type === "image" ||
          typeof value.mime_type === "string" ||
          typeof value.mimeType === "string"
        )
      ) {
        return {
          data: value.data,
          mime: value.mime_type || value.mimeType || "image/png"
        };
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          const found = findImageBlock(item, seen);
          if (found) return found;
        }
        return null;
      }

      for (const key of Object.keys(value)) {
        const found = findImageBlock(value[key], seen);
        if (found) return found;
      }

      return null;
    }

    const image = findImageBlock(data);

    if (!image?.data) {
      console.error("Gemini response without image:", JSON.stringify(data));

      return res.status(500).json({
        error: "Gemini відповів, але не повернув зображення",
        provider: "gemini"
      });
    }

    return res.status(200).json({
      success: true,
      provider: "gemini",
      model,
      b64_json: image.data,
      mime_type: image.mime
    });

  } catch (error) {
    console.error("GEMINI IMAGE API ERROR:", error);

    return res.status(500).json({
      error: error?.message || "Не вдалося створити зображення",
      provider: "gemini"
    });
  }
}
