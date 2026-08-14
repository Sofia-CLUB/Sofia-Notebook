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
    const { prompt, size } = req.body || {};

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        error: "Опишіть зображення"
      });
    }

    // Формуємо URL безкоштовної генерації зображення
    const width =
      size === "1024x1024" ? 1024 :
      size === "1024x768" ? 1024 :
      size === "768x1024" ? 768 :
      1024;

    const height =
      size === "1024x768" ? 768 :
      size === "768x1024" ? 1024 :
      1024;

    const enhancedPrompt =
      "Educational illustration for school lesson, clear, high quality, " +
      "child-friendly, no watermark. " +
      prompt.trim();

    const imageUrl =
      "https://image.pollinations.ai/prompt/" +
      encodeURIComponent(enhancedPrompt) +
      "?width=" + width +
      "&height=" + height +
      "&nologo=true&enhance=true&seed=" + Date.now();

    return res.status(200).json({
      success: true,
      url: imageUrl,
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error("IMAGE API ERROR:", error);

    return res.status(500).json({
      error: "Не вдалося створити зображення"
    });
  }
}
