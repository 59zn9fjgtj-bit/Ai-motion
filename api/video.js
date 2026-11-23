export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const apiKey = process.env.JSON2VIDEO_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé JSON2VIDEO_API_KEY manquante sur Vercel' });
  }

  try {
    const { title = 'MOTION AI', script = '', style = 'Moderne', duration = 10 } = req.body || {};
    const safeText = String(script || 'Création vidéo générée avec MOTION AI').slice(0, 220);

    // 1. Lancer le rendu vidéo sur JSON2Video
    const createRes = await fetch('https://api.json2video.com/v2/movies', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resolution: 'full-hd',
        quality: 'high',
        scenes: [
          {
            comment: 'Scène MOTION AI',
            backgroundColor: '#0f172a',
            duration: Number(duration) || 10,
            elements: [
              {
                type: 'text',
                text: `${title} · ${style}`,
                x: '50%',
                y: '35%',
                width: '80%',
                color: '#a855f7',
                fontFamily: 'Montserrat',
                fontSize: 48,
                textAlign: 'center',
              },
              {
                type: 'text',
                text: safeText,
                x: '50%',
                y: '58%',
                width: '80%',
                color: '#f8fafc',
                fontFamily: 'Open Sans',
                fontSize: 32,
                textAlign: 'center',
              },
            ],
          },
        ],
      }),
    });

    const createData = await createRes.json();
    if (!createRes.ok || !createData.project) {
      return res.status(500).json({ error: 'Erreur JSON2Video', details: createData });
    }

    const projectId = createData.project;

    // 2. Vérifier l'état du rendu (jusqu'à ~25 secondes)
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const statusRes = await fetch(`https://api.json2video.com/v2/movies?project=${projectId}`, {
        headers: { 'x-api-key': apiKey },
      });
      const statusData = await statusRes.json();
      const movie = statusData.movie || statusData;

      if (movie.status === 'done' && movie.url) {
        return res.status(200).json({ url: movie.url, project: projectId });
      }
      if (movie.status === 'error') {
        return res.status(500).json({ error: 'Échec du rendu vidéo', details: movie });
      }
    }

    return res.status(202).json({
      status: 'rendering',
      project: projectId,
      message: 'La vidéo est en cours de rendu sur JSON2Video, réessaie dans quelques secondes.',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
}
