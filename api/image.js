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

    let width = 1024;
    let height = 1024;

    if (size === "1024x768") {
      width = 1024;
      height = 768;
    }

    if (size === "768x1024") {
      width = 768;
      height = 1024;
    }

    if (size === "512x512") {
      width = 512;
      height = 512;
    }

    const enhancedPrompt = `
Educational illustration for a school lesson.
Clear, high quality, child-friendly.
No watermark.
${prompt.trim()}
`;

    const imageUrl =
      "https://gen.pollinations.ai/image/" +
      encodeURIComponent(enhancedPrompt) +
      "?model=flux" +
      "&width=" + width +
      "&height=" + height +
      "&nologo=true" +
      "&key=" + encodeURIComponent(apiKey);

    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();

      console.error(
        "Pollinations image error:",
        imageResponse.status,
        errorText
      );

      return res.status(imageResponse.status).json({
        error:
          "Pollinations не зміг створити зображення. Код: " +
          imageResponse.status
      });
    }

    const contentType =
      imageResponse.headers.get("content-type") || "";

    if (!contentType.startsWith("image/")) {
      const text = await imageResponse.text();

      console.error("Unexpected Pollinations response:", text);

      return res.status(500).json({
        error: "Сервіс повернув не зображення"
      });
    }

    const buffer = Buffer.from(
      await imageResponse.arrayBuffer()
    );

    const base64 = buffer.toString("base64");

    return res.status(200).json({
      success: true,
      b64_json: base64,
      mimeType: contentType
    });

  } catch (error) {
    console.error("IMAGE API ERROR:", error);

    return res.status(500).json({
      error: "Не вдалося створити зображення"
    });
  }
}
