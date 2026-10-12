/**
 * Vercel Serverless Function: /api/ranking
 * 
 * Suporta o Vercel Blob (Private e Public) para salvar 24h na nuvem
 */

const DEFAULT_RANKING = {
  tierNames: {
    "puro-cinema": "Puro Cinema",
    "bom": "Bom",
    "aceitavel": "Aceitável",
    "podia-ser-melhor": "Podia ser Melhor",
    "isso-e-terror": "Isso é Terror?"
  },
  tiers: {
    "puro-cinema": [],
    "bom": [],
    "aceitavel": [],
    "podia-ser-melhor": [],
    "isso-e-terror": []
  },
  unranked: [
    { src: "Imagens/1. A Coisa.jpg", title: "A Coisa" },
    { src: "Imagens/2. O Telefone Preto 2.jpg", title: "O Telefone Preto 2" },
    { src: "Imagens/3. Sobrenatural.jpg", title: "Sobrenatural" },
    { src: "Imagens/4. Fale Comigo.jpg", title: "Fale Comigo" },
    { src: "Imagens/5. O Parque Macabro.jpg", title: "O Parque Macabro" },
    { src: "Imagens/6. A Hora do Pesadelo (2010).jpg", title: "A Hora do Pesadelo (2010)" },
    { src: "Imagens/7. Donnie Darko.jpg", title: "Donnie Darko" },
    { src: "Imagens/7.1 . Criatura Voraz.jpg", title: "Criatura Voraz" },
    { src: "Imagens/8. A Morte do Demônio: Em Chamas.jpg", title: "A Morte do Demônio: Em Chamas" },
    { src: "Imagens/9. A Possessão de Deborah Logan.jpg", title: "A Possessão de Deborah Logan" },
    { src: "Imagens/10. Gonjiam: Manicômio Assombrado.jpg", title: "Gonjiam: Manicômio Assombrado" },
    { src: "Imagens/11. Acampamento Miasma: Adolescência, Sexo e Morte.jpg", title: "Acampamento Miasma: Adolescência, Sexo e Morte" },
    { src: "Imagens/12. Sexta-Feira 13.jpg", title: "Sexta-Feira 13" },
    { src: "Imagens/13. Lenda Urbana.jpg", title: "Lenda Urbana" },
    { src: "Imagens/14. Os Observadores.jpg", title: "Os Observadores" },
    { src: "Imagens/15. Nosferatu (1922).jpg", title: "Nosferatu (1922)" },
    { src: "Imagens/16. Um Drink no Inferno.jpg", title: "Um Drink no Inferno" },
    { src: "Imagens/17. Alien: Romulus.jpg", title: "Alien: Romulus" },
    { src: "Imagens/18. Alien.jpg", title: "Alien" },
    { src: "Imagens/19. Suspirita.jpg", title: "Suspirita" },
    { src: "Imagens/20. Carrie (1976).jpg", title: "Carrie (1976)" },
    { src: "Imagens/21. Albatroz.jpg", title: "Albatroz" },
    { src: "Imagens/22. Eraserhead.jpg", title: "Eraserhead" },
    { src: "Imagens/23. O Anticristo.jpg", title: "O Anticristo" },
    { src: "Imagens/24. Possession.jpg", title: "Possession" },
    { src: "Imagens/25. Skinamarink.jpg", title: "Skinamarink" },
    { src: "Imagens/26. Medo.jpg", title: "Medo" },
    { src: "Imagens/27. Boa Noite, Mamãe! (2022).jpg", title: "Boa Noite, Mamãe! (2022)" },
    { src: "Imagens/28. A Meia-Irmã Feia.jpg", title: "A Meia-Irmã Feia" },
    { src: "Imagens/29. A Autópsia de Jane Doe.jpg", title: "A Autópsia de Jane Doe" },
    { src: "Imagens/30. Rocky Horror Picture Show.jpg", title: "Rocky Horror Picture Show" },
    { src: "Imagens/31. Extermínio.jpg", title: "Extermínio" },
    { src: "Imagens/32. Extermínio 2.jpg", title: "Extermínio 2" },
    { src: "Imagens/33. Extermínio 3.jpg", title: "Extermínio 3" }
  ]
};

let memoryCache = null;

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const DEFAULT_BLOB_TOKEN = 'vercel_blob_rw_VJcSt1wjXLxo6bqy_aiiORLzsCOiMkNnsHksJC9VQTzYaX5';
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_TOKEN || DEFAULT_BLOB_TOKEN;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  // ==========================================
  // 1. CARREGAMENTO (GET)
  // ==========================================
  if (req.method === 'GET') {
    // Opção 1: Vercel Blob (salvo 24h na nuvem)
    if (blobToken) {
      try {
        const { list } = require('@vercel/blob');
        const { blobs } = await list({ prefix: 'ranking.json', token: blobToken });
        if (blobs && blobs.length > 0) {
          const blobItem = blobs[0];
          const targetUrl = blobItem.downloadUrl || blobItem.url;
          const blobRes = await fetch(targetUrl, {
            cache: 'no-store'
          });

          if (blobRes.ok) {
            const data = await blobRes.json();
            if (data && (data.tiers || data.unranked)) {
              memoryCache = data;
              return res.status(200).json({ ...data, _source: 'vercel-blob' });
            }
          }
        }
      } catch (err) {
        console.error('Erro ao ler Vercel Blob:', err.message);
      }
    }

    // Opção 2: Upstash / Redis
    if (redisUrl && redisToken) {
      try {
        const redisRes = await fetch(`${redisUrl}/get/ranking_do_terror`, {
          headers: { Authorization: `Bearer ${redisToken}` }
        });
        if (redisRes.ok) {
          const d = await redisRes.json();
          if (d && d.result) {
            const parsed = typeof d.result === 'string' ? JSON.parse(d.result) : d.result;
            return res.status(200).json({ ...parsed, _source: 'upstash' });
          }
        }
      } catch (err) {
        console.error('Erro ao ler Upstash/Redis:', err.message);
      }
    }

    // Fallback: Cache em memória ou Padrão (sinalizando isDefault se for o padrão inicial)
    if (memoryCache) {
      return res.status(200).json({ ...memoryCache, _source: 'memory' });
    }

    return res.status(200).json({ isDefault: true, ...DEFAULT_RANKING });
  }

  // ==========================================
  // 2. SALVAMENTO (POST)
  // ==========================================
  if (req.method === 'POST') {
    try {
      let bodyData = req.body;
      if (typeof bodyData === 'string') {
        bodyData = JSON.parse(bodyData);
      }

      if (!bodyData) {
        return res.status(400).json({ error: 'Dados inválidos' });
      }

      memoryCache = bodyData;

      // Opção 1: Vercel Blob (salva 24h na nuvem com access: public)
      if (blobToken) {
        try {
          const { put } = require('@vercel/blob');
          const savedBlob = await put('ranking.json', JSON.stringify(bodyData), {
            access: 'public',
            token: blobToken,
            addRandomSuffix: false
          });

          if (savedBlob && savedBlob.url) {
            console.log('Salvo com sucesso no Vercel Blob:', savedBlob.url);
            return res.status(200).json({
              success: true,
              provider: 'vercel-blob',
              url: savedBlob.url
            });
          }
        } catch (err) {
          console.error('Erro ao salvar no Vercel Blob:', err.message);
        }
      }

      // Opção 2: Upstash / Redis
      if (redisUrl && redisToken) {
        try {
          await fetch(`${redisUrl}/set/ranking_do_terror`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${redisToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyData)
          });
          return res.status(200).json({ success: true, provider: 'upstash' });
        } catch (err) {
          console.error('Erro ao salvar no Upstash:', err.message);
        }
      }

      return res.status(200).json({
        success: true,
        provider: 'memory-fallback',
        needsToken: !blobToken
      });
    } catch (err) {
      console.error('Erro no POST /api/ranking:', err);
      return res.status(500).json({ error: 'Erro ao salvar' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
};
