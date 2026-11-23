export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé GEMINI_API_KEY manquante côté serveur" });
  }

  const answers = req.body?.answers || {};

  const instruction = `
Tu es un assistant spécialisé en création vidéo / motion design.
À partir des réponses suivantes : ${JSON.stringify(answers)}
Réponds UNIQUEMENT avec un objet JSON valide de cette forme :
{
  "prompt": "texte détaillé du prompt vidéo en français",
  "storyboard": [
    { "title": "Titre scène 1", "description": "Description scène 1" },
    { "title": "Titre scène 2", "description": "Description scène 2" }
  ]
}
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(rawText);

    return res.status(200).json({
      prompt: parsed.prompt || "",
      storyboard: Array.isArray(parsed.storyboard) ? parsed.storyboard : []
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur interne lors de l'appel à Gemini" });
  }
}
