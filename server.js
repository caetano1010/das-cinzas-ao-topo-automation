const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const localtunnel = require('localtunnel');

// Carregar variáveis de ambiente
dotenv.config();

// Importar Serviços Abstratos (Prontos para Nuvem)
const db = require('./databaseService');
const storage = require('./storageService');
const firebase = require('./firebaseService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Servir a pasta de vídeos prontos estaticamente
const videosDir = storage.getVideosDirectory();
console.log(`[Config] Servindo pasta de vídeos de: ${videosDir}`);
app.use('/videos', express.static(path.resolve(videosDir)));

// Variáveis de controle do túnel
let publicUrl = '';
let tunnelInstance = null;

// Inicializar túnel local
async function startTunnel(port, retries = 5) {
  if (firebase.isCloudEnabled()) {
    console.log('[Tunnel] Cloud habilitado. Pulando inicialização do Localtunnel.');
    return;
  }
  if (tunnelInstance) {
    try {
      tunnelInstance.close();
    } catch (e) {}
  }

  console.log(`[Tunnel] Iniciando túnel na porta ${port}...`);
  try {
    tunnelInstance = await localtunnel({ port });
    publicUrl = tunnelInstance.url;
    console.log(`[Tunnel] Servidor local exposto publicamente em: ${publicUrl}`);

    tunnelInstance.on('close', () => {
      console.log('[Tunnel] O túnel foi fechado. Tentando restabelecer...');
      publicUrl = '';
      setTimeout(() => startTunnel(port), 5000);
    });
  } catch (err) {
    console.error('[Tunnel] Falha ao criar o túnel:', err);
    if (retries > 0) {
      console.log(`[Tunnel] Tentando novamente em 10 segundos... (Tentativas restantes: ${retries})`);
      setTimeout(() => startTunnel(port, retries - 1), 10000);
    }
  }
}

// ==================== ROTAS DE CONFIGURAÇÃO / STATUS ====================

// Obter configurações e status
app.get('/api/settings', async (req, res) => {
  const settings = db.getSettings();
  settings.publicUrl = publicUrl;
  settings.cloudEnabled = firebase.isCloudEnabled();

  // Validar se o token está ativo e obter dados da conta
  let metaStatus = { connected: false, message: 'Não configurado' };
  if (settings.META_ACCESS_TOKEN) {
    try {
      const isIgToken = settings.META_ACCESS_TOKEN.startsWith('IG');
      const apiBase = isIgToken ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
      let targetId = settings.INSTAGRAM_ACCOUNT_ID;

      if (isIgToken) {
        // Obter ID correto do usuário do Instagram associado ao token
        const meRes = await axios.get(`${apiBase}/me`, {
          params: {
            fields: 'id',
            access_token: settings.META_ACCESS_TOKEN
          }
        });
        targetId = meRes.data.id;
      }

      const response = await axios.get(`${apiBase}/v20.0/${targetId}`, {
        params: {
          fields: 'username,name,profile_picture_url,followers_count',
          access_token: settings.META_ACCESS_TOKEN
        }
      });
      metaStatus = {
        connected: true,
        username: response.data.username,
        name: response.data.name,
        profile_picture_url: response.data.profile_picture_url,
        followers_count: response.data.followers_count
      };
    } catch (err) {
      metaStatus = { 
        connected: false, 
        message: err.response?.data?.error?.message || 'Falha ao conectar na API da Meta' 
      };
    }
  }

  res.json({ settings, metaStatus });
});

// Salvar configurações
app.post('/api/settings', (req, res) => {
  const result = db.saveSettings(req.body);
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

// ==================== ROTAS DE VÍDEOS ====================

// Listar vídeos prontos na pasta
app.get('/api/videos', (req, res) => {
  try {
    const videos = storage.listVideos();
    res.json({ success: true, videos });
  } catch (err) {
    console.error('[Videos] Erro ao listar vídeos:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Obter lista de áudios virais
app.get('/api/audios', (req, res) => {
  const audiosDir = path.join(__dirname, 'public', 'audios');
  try {
    if (!fs.existsSync(audiosDir)) {
      return res.json({ success: true, audios: [] });
    }
    const files = fs.readdirSync(audiosDir);
    const audios = files
      .filter(f => f.endsWith('.mp3'))
      .map(file => {
        // Formato legível: "blackandblood.co - DX2D2sDI-gB"
        const cleanName = file.replace('.mp3', '').replace(/_/g, ' - ');
        return {
          fileName: file,
          name: cleanName,
          url: `/audios/${file}`
        };
      });
    res.json({ success: true, audios });
  } catch (err) {
    console.error('[Audios] Erro ao listar áudios:', err);
    res.status(500).json({ success: false, message: 'Erro ao ler pasta de áudios.' });
  }
});

// Mixar música com o vídeo usando FFmpeg (copying video stream, re-encoding audio with fade-out)
app.post('/api/mix-music', (req, res) => {
  const { fileName, audioName } = req.body;

  if (!fileName || !audioName) {
    return res.status(400).json({ success: false, message: 'Parâmetros fileName e audioName são obrigatórios.' });
  }

  const { execSync } = require('child_process');
  
  const videoPath = path.resolve(videosDir, fileName);
  const audioPath = path.resolve(__dirname, 'public', 'audios', audioName);
  const tempOutputPath = path.resolve(videosDir, `temp_${fileName}`);

  if (!fs.existsSync(videoPath)) {
    return res.status(400).json({ success: false, message: 'Vídeo original não encontrado.' });
  }
  if (!fs.existsSync(audioPath)) {
    return res.status(400).json({ success: false, message: 'Trilha de áudio não encontrada.' });
  }

  try {
    console.log(`[Mixer] Obtendo duração do vídeo: ${fileName}...`);
    // Obter duração via ffprobe
    const durationStr = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
      { encoding: 'utf-8' }
    );
    const duration = parseFloat(durationStr.trim());
    
    if (isNaN(duration) || duration <= 0) {
      throw new Error('Duração do vídeo inválida.');
    }

    console.log(`[Mixer] Duração: ${duration}s. Iniciando renderização...`);

    // Calcular o início do fade-out
    const fadeStart = Math.max(0, duration - 3);

    // Executar o FFmpeg
    // -c:v copy copia a imagem original instantaneamente sem perder qualidade
    // -c:a aac re-codifica o áudio para aplicar o filtro de fade-out
    const cmd = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v copy -map 0:v -map 1:a -c:a aac -shortest -filter_complex "[1:a]afade=t=out:st=${fadeStart}:d=3[a]" -map "[a]" "${tempOutputPath}"`;
    execSync(cmd, { stdio: 'ignore' });

    // Substituir o arquivo original
    fs.unlinkSync(videoPath);
    fs.renameSync(tempOutputPath, videoPath);

    console.log(`[Mixer] Sucesso ao mixar áudio ${audioName} no vídeo ${fileName}`);
    res.json({ success: true, message: 'Música aplicada com sucesso!' });
  } catch (err) {
    console.error('[Mixer] Erro ao mixar áudio no vídeo:', err);
    if (fs.existsSync(tempOutputPath)) {
      try { fs.unlinkSync(tempOutputPath); } catch (e) {}
    }
    res.status(500).json({ success: false, message: `Erro ao mixar áudio: ${err.message}` });
  }
});

// ==================== ROTAS DE POSTAGEM / AGENDAMENTO ====================

// Obter agenda de posts e histórico
app.get('/api/schedule', async (req, res) => {
  try {
    res.json({
      schedule: await db.getSchedule(),
      posts: await db.getPosts()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Agendar ou publicar post
app.post('/api/schedule', async (req, res) => {
  const { videoId, fileName, caption, scheduledAt, postInstagram, postFacebook, postTrial, isAiGenerated } = req.body;

  const newPost = {
    id: '_' + Math.random().toString(36).substr(2, 9),
    videoId,
    fileName,
    caption,
    postInstagram: !!postInstagram,
    postFacebook: !!postFacebook,
    postTrial: !!postTrial,
    isAiGenerated: !!isAiGenerated, // Salvar flag de conteúdo gerado por IA
    status: scheduledAt ? 'Agendado' : 'Publicando...',
    scheduledAt: scheduledAt || null, // Formato ISOString ou nulo (imediato)
    createdAt: new Date().toISOString(),
    publishedAt: null,
    error: null,
    metaData: {}
  };

  await db.addSchedule(newPost);

  if (!scheduledAt) {
    // Disparar publicação assíncrona imediatamente
    publishPostAsync(newPost.id);
    return res.json({ success: true, message: 'Publicação iniciada!', post: newPost });
  }

  res.json({ success: true, message: 'Post agendado com sucesso!', post: newPost });
});

// Remover post agendado
app.delete('/api/schedule/:id', async (req, res) => {
  await db.deleteSchedule(req.params.id);
  res.json({ success: true, message: 'Post agendado cancelado.' });
});

// Sincronizar fila local de Reels com a Nuvem (Firebase)
app.post('/api/cloud/sync', async (req, res) => {
  if (!firebase.isCloudEnabled()) {
    return res.status(400).json({ success: false, message: 'Modo Nuvem (Firebase) não está ativo no servidor local.' });
  }

  try {
    const localDb = db.read();
    const localSchedule = localDb.schedule || [];
    const localPosts = localDb.posts || [];
    
    console.log(`[Sync] Iniciando sincronização: ${localSchedule.length} posts agendados na fila local.`);
    
    let uploadedCount = 0;
    
    // 1. Fazer upload das mídias correspondentes aos agendamentos
    for (const post of localSchedule) {
      if (!post.videoUrl) {
        const localFilePath = path.join(videosDir, post.fileName);
        if (fs.existsSync(localFilePath)) {
          console.log(`[Sync] Fazendo upload do Reel #${post.videoId} (${post.fileName})...`);
          const cloudUrl = await storage.uploadToCloud(post.fileName, localFilePath);
          post.videoUrl = cloudUrl;
          uploadedCount++;
        } else {
          console.warn(`[Sync] Vídeo local não encontrado: ${localFilePath}`);
        }
      }
      
      // 2. Gravar no Firestore
      console.log(`[Sync] Salvando post ID ${post.id} no Firestore...`);
      await firebase.dbFirestore.collection('schedule').doc(post.id).set(post);
    }

    // 3. Sincronizar posts do histórico para ter o painel sincronizado
    for (const post of localPosts) {
      await firebase.dbFirestore.collection('posts').doc(post.id).set(post);
    }

    // 4. Salvar de volta no banco local para reter as URLs do Firebase localmente
    db.write(localDb);

    res.json({
      success: true,
      message: 'Sincronização concluída com sucesso!',
      totalSynced: localSchedule.length,
      uploadedCount
    });
  } catch (err) {
    console.error('[Sync] Falha na sincronização com o Firebase:', err);
    res.status(500).json({ success: false, message: `Erro ao sincronizar com a nuvem: ${err.message}` });
  }
});

// ==================== WEBHOOKS DA META (FB/IG COMPOSTOS) ====================

// Rota de Verificação do Webhook (GET) - Exigida pela Meta para ativação
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'das_cinzas_ao_topo_secret_token';
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Webhook] Webhook verificado com sucesso pela Meta!');
      return res.status(200).send(challenge);
    } else {
      console.log('[Webhook] Falha de verificação do token.');
      return res.sendStatus(403);
    }
  }
  res.sendStatus(400);
});

// Rota de Eventos do Webhook (POST) - Onde o Meta envia os comentários/DMs
app.post('/webhook', (req, res) => {
  const body = req.body;

  if (body.object === 'page' || body.object === 'instagram') {
    console.log('[Webhook] Novo evento recebido do Meta:');
    console.log(JSON.stringify(body, null, 2));

    // TODO FUTURAMENTE:
    // 1. Identificar se é comentário ou mensagem direta.
    // 2. Chamar a API de LLM (ex: Gemini/Claude) para processar.
    // 3. Responder usando a Graph API.

    return res.status(200).send('EVENT_RECEIVED');
  } else {
    return res.sendStatus(404);
  }
});

// ==================== ENGINE DE PUBLICAÇÃO DO META API ====================

async function publishPostAsync(postId) {
  console.log(`[Publisher] Iniciando publicação para o Post ID: ${postId}`);
  
  const schedule = await db.getSchedule();
  const post = schedule.find(p => p.id === postId);
  
  if (!post) {
    console.error(`[Publisher] Post ${postId} não encontrado no banco.`);
    return;
  }

  // Atualizar para status temporário de envio
  await db.updateScheduleStatus(postId, 'Publicando...');

  const settings = db.getSettings();
  const accessToken = settings.META_ACCESS_TOKEN;
  const instagramAccountId = settings.INSTAGRAM_ACCOUNT_ID;
  const facebookPageId = settings.FACEBOOK_PAGE_ID;

  if (!accessToken) {
    await db.updateScheduleStatus(postId, 'Erro', 'Token de Acesso do Meta ausente no .env');
    return;
  }

  let igPostId = null;
  let fbPostId = null;
  const errors = [];

  // 1. Garantir que o túnel esteja ativo se não tivermos uma URL na nuvem
  if (!post.videoUrl && !publicUrl) {
    console.log('[Publisher] Túnel não está disponível. Tentando religar...');
    await startTunnel(PORT);
    if (!publicUrl) {
      await db.updateScheduleStatus(postId, 'Erro', 'Não foi possível estabelecer uma URL pública HTTPS usando o Localtunnel.');
      return;
    }
  }

  const videoUrl = post.videoUrl || `${publicUrl}/videos/${post.fileName}`;
  console.log(`[Publisher] URL do vídeo para download do Meta: ${videoUrl}`);

  // 2. Publicar no Instagram (Reels)
  if (post.postInstagram) {
    if (!instagramAccountId && !accessToken.startsWith('IG')) {
      errors.push('ID da Conta do Instagram ausente');
    } else {
      try {
        console.log('[Publisher] Criando container de mídia no Instagram...');
        
        const isIgToken = accessToken.startsWith('IG');
        const apiBase = isIgToken ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
        
        let resolvedAccountId = instagramAccountId;
        if (isIgToken) {
          console.log('[Publisher] Token do Instagram detectado. Resolvendo ID correto via /me...');
          const meRes = await axios.get(`${apiBase}/me`, {
            params: { fields: 'id', access_token: accessToken }
          });
          resolvedAccountId = meRes.data.id;
          console.log(`[Publisher] ID resolvido: ${resolvedAccountId}`);
        }

        const containerPayload = {
          media_type: 'REELS',
          video_url: videoUrl,
          caption: post.caption,
          access_token: accessToken
        };

        if (post.isAiGenerated) {
          console.log('[Publisher] Marcando publicação com rótulo "Criado por IA" (is_ai_generated: true)');
          containerPayload.is_ai_generated = true;
        }

        if (post.postTrial) {
          console.log('[Publisher] Configurando Reels como Post de Teste (Trial Reel)...');
          containerPayload.trial_params = {
            graduation_strategy: 'MANUAL'
          };
        }

        const createContainerRes = await axios.post(`${apiBase}/v20.0/${resolvedAccountId}/media`, containerPayload);

        const containerId = createContainerRes.data.id;
        console.log(`[Publisher] Container criado com ID: ${containerId}. Aguardando processamento...`);

        // Polling do status do vídeo
        let status = 'IN_PROGRESS';
        let checkCount = 0;
        const maxChecks = 30; // 2.5 minutos de espera máxima

        while (status === 'IN_PROGRESS' && checkCount < maxChecks) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          checkCount++;

          const statusRes = await axios.get(`${apiBase}/v20.0/${containerId}`, {
            params: {
              fields: 'status_code',
              access_token: accessToken
            }
          });

          status = statusRes.data.status_code;
          console.log(`[Publisher] Status do container (tentativa ${checkCount}): ${status}`);
        }

        if (status === 'FINISHED') {
          console.log('[Publisher] Vídeo processado! Publicando Reel...');
          const publishRes = await axios.post(`${apiBase}/v20.0/${resolvedAccountId}/media_publish`, {
            creation_id: containerId,
            access_token: accessToken
          });
          igPostId = publishRes.data.id;
          console.log(`[Publisher] Reel publicado com sucesso! ID: ${igPostId}`);
        } else {
          errors.push(`Processamento do vídeo no Instagram expirou ou falhou (Status: ${status})`);
        }
      } catch (err) {
        console.error('[Publisher] Erro ao postar no Instagram:', err.response?.data || err.message);
        errors.push(`Instagram: ${err.response?.data?.error?.message || err.message}`);
      }
    }
  }

  // 3. Publicar no Facebook (Vídeo/Page Feed)
  if (post.postFacebook) {
    if (!facebookPageId) {
      errors.push('ID da Página do Facebook ausente');
    } else {
      try {
        console.log('[Publisher] Publicando vídeo na Página do Facebook...');
        const fbPublishRes = await axios.post(`https://graph.facebook.com/v20.0/${facebookPageId}/videos`, {
          file_url: videoUrl,
          description: post.caption,
          title: `Reel ${post.videoId}`,
          access_token: accessToken
        });

        fbPostId = fbPublishRes.data.id;
        console.log(`[Publisher] Post publicado no Facebook! ID: ${fbPostId}`);
      } catch (err) {
        console.error('[Publisher] Erro ao postar no Facebook:', err.response?.data || err.message);
        errors.push(`Facebook: ${err.response?.data?.error?.message || err.message}`);
      }
    }
  }

  // 4. Atualizar status final no DB
  if (errors.length > 0) {
    await db.updateScheduleStatus(postId, 'Erro', errors.join(' | '));
    console.log(`[Publisher] Publicação concluída com erros: ${errors.join(' | ')}`);
  } else {
    await db.updateScheduleStatus(postId, 'Publicado', null, new Date().toISOString(), {
      instagramMediaId: igPostId,
      facebookVideoId: fbPostId
    });
    console.log(`[Publisher] Publicação concluída com sucesso!`);
  }
}

// ==================== SERVIÇO DE CRON JOB (AGENDADOR) ====================

cron.schedule('* * * * *', async () => {
  const schedule = await db.getSchedule();
  const now = new Date();

  schedule.forEach(post => {
    if (post.status === 'Agendado' && post.scheduledAt) {
      const scheduledTime = new Date(post.scheduledAt);
      if (scheduledTime <= now) {
        console.log(`[Cron] Horário atingido para o Post ID ${post.id}. Disparando publicação...`);
        publishPostAsync(post.id);
      }
    }
  });
});

// ==================== INICIALIZAÇÃO DO SERVIDOR ====================

app.listen(PORT, async () => {
  console.log(`[Server] Servidor Express rodando na porta ${PORT}`);
  // Iniciar o túnel local
  await startTunnel(PORT);
});
