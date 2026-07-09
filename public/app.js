// Estado Global da Aplicação
const state = {
  activeTab: 'dashboard',
  videos: [],
  audios: [],
  schedule: [],
  posts: [],
  settings: {},
  metaStatus: {}
};

// Inicialização da Página
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  // Atualizar dados periodicamente (a cada 30 segundos)
  setInterval(refreshData, 30000);
});

async function initApp() {
  await fetchSettings();
  await fetchVideos();
  await fetchAudios();
  await fetchSchedule();
}

async function refreshData() {
  await fetchSchedule();
}

// Alternar Abas de Navegação
function switchTab(tabId) {
  state.activeTab = tabId;
  
  // Atualizar classes dos botões
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Atualizar visibilidade das seções
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.remove('active');
  });
  const activeSection = document.getElementById(`tab-${tabId}`);
  if (activeSection) activeSection.classList.add('active');

  // Carregar dados específicos da aba se necessário
  if (tabId === 'videos') {
    fetchVideos();
  } else if (tabId === 'calendar' || tabId === 'dashboard') {
    fetchSchedule();
  }
}

// ==================== REQUISIÇÕES DE API ====================

// Obter Configurações e Status da Meta
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    state.settings = data.settings;
    state.metaStatus = data.metaStatus;

    renderSettingsForm();
    renderMetaStatus();
    renderTunnelStatus();
    renderAutomationStatus();
    renderCloudSyncStatus();
    
    // Ajustar interface para ambiente Cloud (Render)
    adjustUIForCloud();
  } catch (err) {
    console.error('Erro ao buscar configurações:', err);
  }
}

// Ocultar abas e cards locais quando acessado via URL de nuvem (Render)
function adjustUIForCloud() {
  const isCloudEnv = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  if (isCloudEnv) {
    // 1. A aba de Vídeos Prontos DEVE ficar visível na nuvem para download
    const videosTabBtn = document.getElementById('tab-btn-videos');
    if (videosTabBtn) videosTabBtn.style.display = 'flex';
    
    // 2. Ocultar card de Sincronização Nuvem no painel
    const cloudSyncCard = document.getElementById('cloud-sync-container');
    if (cloudSyncCard) cloudSyncCard.style.display = 'none';
    
    // 3. Ocultar badge de Túnel
    const tunnelBadge = document.getElementById('tunnel-badge');
    if (tunnelBadge) tunnelBadge.style.display = 'none';
  }
}

// Obter Vídeos Prontos Escaneados
async function fetchVideos() {
  try {
    const res = await fetch('/api/videos');
    const data = await res.json();
    if (data.success) {
      state.videos = data.videos;
      renderVideosList();
    } else {
      showVideosError(data.message);
    }
  } catch (err) {
    console.error('Erro ao buscar vídeos:', err);
    showVideosError('Erro ao conectar ao servidor local.');
  }
}

// Obter Cronograma e Histórico de Postagens
async function fetchSchedule() {
  try {
    const res = await fetch('/api/schedule');
    const data = await res.json();
    state.schedule = data.schedule;
    state.posts = data.posts;

    renderScheduleQueue();
    renderPostsHistory();
    renderStatsSummary();
  } catch (err) {
    console.error('Erro ao buscar cronograma:', err);
  }
}

// Salvar Configurações
async function saveMetaSettings(event) {
  event.preventDefault();
  
  const payload = {
    META_APP_ID: document.getElementById('settings-app-id').value.trim(),
    META_APP_SECRET: document.getElementById('settings-app-secret').value.trim(),
    META_ACCESS_TOKEN: document.getElementById('settings-access-token').value.trim(),
    INSTAGRAM_ACCOUNT_ID: document.getElementById('settings-instagram-id').value.trim(),
    FACEBOOK_PAGE_ID: document.getElementById('settings-facebook-id').value.trim(),
    THREADS_ACCESS_TOKEN: document.getElementById('settings-threads-token').value.trim(),
    THREADS_ACCOUNT_ID: document.getElementById('settings-threads-id').value.trim(),
    AUTOMATION_PAUSED: document.getElementById('settings-automation-paused').checked ? 'true' : 'false',
    FIREBASE_STORAGE_BUCKET: state.settings.FIREBASE_STORAGE_BUCKET || ''
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    
    if (data.success) {
      alert(data.message);
      fetchSettings(); // Recarregar para validar conexão
      switchTab('dashboard'); // Voltar para o painel principal
    } else {
      alert('Erro: ' + data.message);
    }
  } catch (err) {
    console.error('Erro ao salvar credenciais:', err);
    alert('Erro de conexão ao salvar credenciais.');
  }
}

// Agendar / Postar Reel
async function submitPostSchedule(event) {
  event.preventDefault();

  const scheduledAtInput = document.getElementById('form-schedule-date').value;
  let scheduledAt = null;
  if (scheduledAtInput) {
    // Converter de data/hora local para ISOString (UTC)
    scheduledAt = new Date(scheduledAtInput).toISOString();
  }

  const payload = {
    videoId: document.getElementById('form-video-id').value,
    fileName: document.getElementById('form-video-filename').value,
    caption: document.getElementById('form-caption').value,
    postInstagram: document.getElementById('form-post-instagram').checked,
    postFacebook: document.getElementById('form-post-facebook').checked,
    postThreads: document.getElementById('form-post-threads').checked,
    postTrial: document.getElementById('form-post-trial').checked,
    isAiGenerated: document.getElementById('form-post-ai-generated').checked,
    scheduledAt
  };

  if (!payload.postInstagram && !payload.postFacebook && !payload.postThreads) {
    alert('Por favor, selecione pelo menos uma plataforma (Instagram, Facebook ou Threads).');
    return;
  }

  try {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      alert(data.message);
      // Resetar form
      document.getElementById('post-schedule-form').reset();
      document.getElementById('video-preview-form-container').style.display = 'none';
      document.getElementById('video-preview-select-msg').style.display = 'block';
      
      // Remover seleção da lista
      document.querySelectorAll('.video-item-btn').forEach(btn => btn.classList.remove('active'));
      
      fetchSchedule(); // Atualizar cronograma
      switchTab('calendar'); // Redirecionar para o calendário
    } else {
      alert('Erro: ' + data.message);
    }
  } catch (err) {
    console.error('Erro ao salvar postagem:', err);
    alert('Erro ao enviar postagem.');
  }
}

// Deletar item agendado
async function deleteScheduledPost(id) {
  if (!confirm('Deseja realmente cancelar este agendamento?')) return;

  try {
    const res = await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      fetchSchedule();
    } else {
      alert('Erro: ' + data.message);
    }
  } catch (err) {
    console.error('Erro ao deletar post:', err);
  }
}

// ==================== FUNÇÕES DE RENDERIZAÇÃO ====================

// Renderizar status do Túnel Localtunnel
function renderTunnelStatus() {
  const badge = document.getElementById('tunnel-badge');
  const dot = document.getElementById('tunnel-dot');
  const text = document.getElementById('tunnel-text');

  if (state.settings.publicUrl) {
    dot.className = 'status-dot online';
    text.innerText = 'Túnel Ativo';
    badge.title = `URL pública: ${state.settings.publicUrl}`;
  } else {
    dot.className = 'status-dot offline';
    text.innerText = 'Túnel Desconectado';
    badge.removeAttribute('title');
  }
}

// Renderizar status da Automação (Pausada ou Ativa)
function renderAutomationStatus() {
  const badge = document.getElementById('automation-badge');
  const dot = document.getElementById('automation-dot');
  const text = document.getElementById('automation-text');

  if (!badge || !dot || !text) return;

  if (state.settings.AUTOMATION_PAUSED === 'true') {
    dot.className = 'status-dot offline';
    text.innerText = 'Automação Pausada';
    badge.title = 'A automação de segundo plano (cron, fila e webhook/túnel) está suspensa.';
  } else {
    dot.className = 'status-dot online';
    text.innerText = 'Automação Ativa';
    badge.title = 'A automação está processando a fila e webhooks normalmente.';
  }
}

// Renderizar status de Sincronização Cloud
function renderCloudSyncStatus() {
  const modeText = document.getElementById('cloud-mode-text');
  const syncBtn = document.getElementById('btn-cloud-sync');
  
  if (state.settings.cloudEnabled) {
    modeText.innerHTML = `<span class="badge" style="background: rgba(76,175,80,0.15); color: #4caf50; border: 1px solid rgba(76,175,80,0.3); font-weight: 600; padding: 4px 8px; border-radius: 4px;">Nuvem Habilitada</span>`;
    syncBtn.style.display = 'block';
  } else {
    modeText.innerHTML = `<span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px;">Somente Local</span>`;
    syncBtn.style.display = 'none';
  }
}

// Disparar sincronização local para a nuvem
async function syncLocalToCloud() {
  const syncBtn = document.getElementById('btn-cloud-sync');
  const progressMsg = document.getElementById('sync-progress-msg');
  
  if (!confirm('Deseja iniciar a sincronização com a Nuvem? Isso fará o upload dos vídeos novos e sincronizará a fila no Firebase.')) {
    return;
  }
  
  syncBtn.disabled = true;
  syncBtn.innerText = 'Sincronizando...';
  progressMsg.style.display = 'block';
  
  try {
    const res = await fetch('/api/cloud/sync', { method: 'POST' });
    const data = await res.json();
    
    if (data.success) {
      alert(`Sincronização concluída com sucesso!\nTotal de posts sincronizados: ${data.totalSynced}\nVídeos novos enviados: ${data.uploadedCount}`);
      fetchSchedule(); // Recarregar fila e histórico
    } else {
      alert('Erro na sincronização: ' + data.message);
    }
  } catch (err) {
    console.error('Erro na requisição de sincronização:', err);
    alert('Erro de conexão ao sincronizar com a Nuvem.');
  } finally {
    syncBtn.disabled = false;
    syncBtn.innerText = 'Sincronizar com a Nuvem (Firebase)';
    progressMsg.style.display = 'none';
  }
}

// Renderizar status da conta conectada do Instagram
function renderMetaStatus() {
  const container = document.getElementById('meta-account-info');
  
  if (state.metaStatus.connected) {
    container.innerHTML = `
      <img src="${state.metaStatus.profile_picture_url || 'https://via.placeholder.com/60'}" alt="Foto Perfil" class="profile-avatar">
      <div class="profile-details">
        <h3>@${state.metaStatus.username}</h3>
        <p>${state.metaStatus.name || 'Conta Profissional'}</p>
        <p><strong>${state.metaStatus.followers_count.toLocaleString()}</strong> seguidores</p>
      </div>
    `;
    document.getElementById('meta-token-warning').style.display = 'none';
  } else {
    container.innerHTML = `
      <div class="profile-details">
        <h3 class="error-text">API Desconectada</h3>
        <p>${state.metaStatus.message || 'Configure suas credenciais na aba Configurações.'}</p>
      </div>
    `;
    if (state.settings.META_ACCESS_TOKEN) {
      document.getElementById('meta-token-warning').style.display = 'block';
    }
  }
}

// Preencher formulário de configurações com dados salvos
function renderSettingsForm() {
  document.getElementById('settings-app-id').value = state.settings.META_APP_ID || '';
  document.getElementById('settings-app-secret').value = state.settings.META_APP_SECRET || '';
  document.getElementById('settings-access-token').value = state.settings.META_ACCESS_TOKEN || '';
  document.getElementById('settings-instagram-id').value = state.settings.INSTAGRAM_ACCOUNT_ID || '';
  document.getElementById('settings-facebook-id').value = state.settings.FACEBOOK_PAGE_ID || '';
  document.getElementById('settings-threads-token').value = state.settings.THREADS_ACCESS_TOKEN || '';
  document.getElementById('settings-threads-id').value = state.settings.THREADS_ACCOUNT_ID || '';
  
  const pausedCheckbox = document.getElementById('settings-automation-paused');
  if (pausedCheckbox) {
    pausedCheckbox.checked = state.settings.AUTOMATION_PAUSED === 'true';
  }
}

// Renderizar resumo de contagens no painel
function renderStatsSummary() {
  document.getElementById('stats-total-posts').innerText = state.posts.filter(p => p.status === 'Publicado').length;
  document.getElementById('stats-total-errors').innerText = state.posts.filter(p => p.status === 'Erro').length;
}

// Renderizar Lista Lateral de Vídeos
function renderVideosList() {
  const container = document.getElementById('videos-list-items');
  if (state.videos.length === 0) {
    container.innerHTML = '<p class="placeholder-text">Nenhum vídeo vertical (.mp4) encontrado na pasta configurada.</p>';
    return;
  }

  container.innerHTML = '';
  state.videos.forEach(video => {
    const btn = document.createElement('button');
    btn.className = 'video-item-btn';
    btn.id = `video-btn-${video.id}`;
    btn.onclick = () => selectVideoForPreview(video);
    
    // Verificar se já foi publicado no histórico de posts
    const isPublished = state.posts.some(p => String(p.videoId) === String(video.id) && p.status === 'Publicado');
    
    // Obter primeira linha da legenda para o preview
    const cleanCaption = video.caption ? video.caption.split('\n')[0] : 'Sem legenda configurada';
    
    const badgeHtml = isPublished 
      ? `<span class="badge publicado" style="margin-left: 8px; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(52, 199, 89, 0.15); color: #34c759; border: 1px solid rgba(52, 199, 89, 0.3);">Publicado</span>` 
      : '';

    btn.innerHTML = `
      <div class="video-title-item" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <span>Reel #${video.id}</span>
        ${badgeHtml}
      </div>
      <div class="video-desc-item">${cleanCaption}</div>
    `;
    container.appendChild(btn);
  });
}

function showVideosError(msg) {
  const container = document.getElementById('videos-list-items');
  container.innerHTML = `<p class="error-text" style="font-size: 0.85rem;">Erro: ${msg}</p>`;
}

// Selecionar Vídeo para visualizar e configurar
function selectVideoForPreview(video) {
  // Atualizar botões ativos
  document.querySelectorAll('.video-item-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`video-btn-${video.id}`).classList.add('active');

  // Exibir form e ocultar aviso
  document.getElementById('video-preview-select-msg').style.display = 'none';
  document.getElementById('video-preview-form-container').style.display = 'block';

  // Configurar Player
  const player = document.getElementById('preview-video-player');
  player.src = video.url;
  player.load();

  // Configurar Botão de Download
  const downloadBtn = document.getElementById('btn-download-video');
  if (downloadBtn) {
    downloadBtn.href = video.url;
    downloadBtn.download = video.fileName;
  }

  // Preencher formulário
  document.getElementById('form-video-id').value = video.id;
  document.getElementById('form-video-filename').value = video.fileName;
  document.getElementById('form-caption').value = video.caption || '';
  
  // Limpar seleção de áudio anterior
  document.getElementById('mixer-audio-select').value = '';
  document.getElementById('mixer-audio-player').style.display = 'none';
  document.getElementById('mixer-audio-player').src = '';

  // Limpar agendamento prévio
  document.getElementById('form-schedule-date').value = '';
}

// Renderizar fila de agendados
function renderScheduleQueue() {
  const tbody = document.getElementById('schedule-queue-body');
  const agendados = state.schedule.filter(p => p.status === 'Agendado');

  if (agendados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Nenhum post agendado na fila.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  agendados.forEach(post => {
    const tr = document.createElement('tr');
    
    const dateFormatted = new Date(post.scheduledAt).toLocaleString('pt-BR');
    const platforms = [];
    if (post.postInstagram) platforms.push('Instagram');
    if (post.postFacebook) platforms.push('Facebook');
    if (post.postThreads) platforms.push('Threads');

    const cleanCaption = post.caption ? post.caption.split('\n')[0] : 'Sem legenda';

    tr.innerHTML = `
      <td><strong>Reel #${post.videoId}</strong><br><small>${post.fileName}</small></td>
      <td><span class="video-desc-item" style="max-width: 250px; display: inline-block;">${cleanCaption}</span></td>
      <td>${platforms.join(' + ')}</td>
      <td>${dateFormatted}</td>
      <td><span class="badge agendado">Agendado</span></td>
      <td>
        <button class="btn-danger-sm" onclick="deleteScheduledPost('${post.id}')">Cancelar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Renderizar histórico de publicações
function renderPostsHistory() {
  const tbody = document.getElementById('posts-history-body');

  if (state.posts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Nenhum post publicado ou com erro no histórico.</td></tr>';
    return;
  }

  // Ordenar posts: mais recentes primeiro
  const sortedPosts = [...state.posts].sort((a, b) => {
    const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(a.createdAt);
    const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(b.createdAt);
    return dateB - dateA;
  });

  tbody.innerHTML = '';
  sortedPosts.forEach(post => {
    const tr = document.createElement('tr');
    
    const dateFormatted = post.publishedAt 
      ? new Date(post.publishedAt).toLocaleString('pt-BR') 
      : new Date(post.createdAt).toLocaleString('pt-BR');
      
    const platforms = [];
    if (post.postInstagram) platforms.push('Instagram');
    if (post.postFacebook) platforms.push('Facebook');
    if (post.postThreads) platforms.push('Threads');

    const statusBadge = post.status === 'Publicado'
      ? `<span class="badge publicado">Publicado</span>`
      : `<span class="badge erro" title="${post.error || 'Erro desconhecido'}">Erro</span>`;

    const cleanCaption = post.caption ? post.caption.split('\n')[0] : 'Sem legenda';

    tr.innerHTML = `
      <td><strong>Reel #${post.videoId}</strong><br><small>${post.fileName}</small></td>
      <td>
        <span class="video-desc-item" style="max-width: 250px; display: inline-block;">${cleanCaption}</span>
        ${post.error ? `<br><small class="error-text" style="font-size:0.75rem;">Erro: ${post.error}</small>` : ''}
      </td>
      <td>${platforms.join(' + ')}</td>
      <td>${dateFormatted}</td>
      <td>${statusBadge}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==================== FUNÇÕES DO MIXER DE ÁUDIO ====================

// Buscar faixas de áudio
async function fetchAudios() {
  try {
    const res = await fetch('/api/audios');
    const data = await res.json();
    if (data.success) {
      state.audios = data.audios;
      renderAudiosSelect();
    }
  } catch (err) {
    console.error('Erro ao buscar áudios:', err);
  }
}

// Preencher a caixinha select com os áudios virais
function renderAudiosSelect() {
  const select = document.getElementById('mixer-audio-select');
  
  // Preservar primeira opção
  select.innerHTML = '<option value="">-- Sem música / Manter áudio original --</option>';
  
  state.audios.forEach(audio => {
    const option = document.createElement('option');
    option.value = audio.fileName;
    option.innerText = audio.name;
    select.appendChild(option);
  });
}

// Ouvir pré-visualização da música
function previewAudioTrack() {
  const select = document.getElementById('mixer-audio-select');
  const player = document.getElementById('mixer-audio-player');
  
  const fileName = select.value;
  if (!fileName) {
    player.style.display = 'none';
    player.src = '';
    return;
  }
  
  const audio = state.audios.find(a => a.fileName === fileName);
  if (audio) {
    player.src = audio.url;
    player.style.display = 'block';
    player.load();
    player.play();
  }
}

// Chamar a API local para mixar
async function mixSelectedMusic() {
  const fileName = document.getElementById('form-video-filename').value;
  const audioName = document.getElementById('mixer-audio-select').value;
  const btn = document.getElementById('btn-mix-music');

  if (!audioName) {
    alert('Por favor, selecione uma trilha de áudio antes de aplicar.');
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Mixando Áudio via FFmpeg...';

  try {
    const res = await fetch('/api/mix-music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, audioName })
    });
    const data = await res.json();

    if (data.success) {
      alert('Música aplicada com sucesso ao vídeo!');
      
      // Resetar form de áudio
      document.getElementById('mixer-audio-select').value = '';
      document.getElementById('mixer-audio-player').style.display = 'none';
      document.getElementById('mixer-audio-player').src = '';

      // Atualizar o player de vídeo para carregar a nova versão (com cache-buster)
      const player = document.getElementById('preview-video-player');
      const baseSrc = player.src.split('?')[0];
      player.src = `${baseSrc}?t=${Date.now()}`;
      player.load();

      // Recarregar lista de vídeos
      fetchVideos();
    } else {
      alert('Erro ao aplicar música: ' + data.message);
    }
  } catch (err) {
    console.error('Erro na requisição de mixagem:', err);
    alert('Erro de conexão ao processar áudio.');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Juntar Trilha ao Vídeo (FFmpeg)';
  }
}

// Limpar banco de dados administrativamente
async function clearDatabase() {
  if (!confirm('ATENÇÃO: Isso deletará permanentemente toda a fila de agendamentos e o histórico de publicações (tanto local quanto na nuvem). Deseja continuar?')) {
    return;
  }

  try {
    const res = await fetch('/api/admin/clear-db', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      fetchSchedule(); // Atualizar visualização
      switchTab('dashboard'); // Voltar para o painel principal
    } else {
      alert('Erro ao limpar dados: ' + data.message);
    }
  } catch (err) {
    console.error('Erro na requisição de limpeza:', err);
    alert('Erro de conexão ao limpar dados.');
  }
}

// Copiar legenda para a área de transferência com feedback visual
function copyCaptionToClipboard() {
  const captionText = document.getElementById('form-caption').value;
  if (!captionText) {
    alert('Não há legenda para copiar.');
    return;
  }
  
  navigator.clipboard.writeText(captionText)
    .then(() => {
      const btn = document.getElementById('btn-copy-caption');
      const originalText = btn.innerHTML;
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copiado!`;
      btn.style.borderColor = 'var(--color-success)';
      btn.style.color = 'var(--color-success)';
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.color = 'var(--accent-gold)';
      }, 2000);
    })
    .catch(err => {
      console.error('Erro ao copiar legenda:', err);
      alert('Falha ao copiar legenda.');
    });
}

// Marcar vídeo selecionado como publicado manualmente no histórico
async function markAsPublished() {
  const videoId = document.getElementById('form-video-id').value;
  const fileName = document.getElementById('form-video-filename').value;
  const caption = document.getElementById('form-caption').value;
  
  if (!videoId || !fileName) {
    alert('Selecione um vídeo antes de marcar como publicado.');
    return;
  }

  if (!confirm(`Deseja marcar o Reel #${videoId} como publicado no seu histórico de postagens?`)) {
    return;
  }

  const btn = document.getElementById('btn-mark-published');
  btn.disabled = true;
  btn.innerText = 'Marcando...';

  try {
    const res = await fetch('/api/videos/publish-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, fileName, caption })
    });
    const data = await res.json();

    if (data.success) {
      alert(data.message);
      await fetchSchedule(); // Atualizar histórico no estado
      renderVideosList(); // Atualizar visualização para mostrar o badge de publicado
    } else {
      alert('Erro: ' + data.message);
    }
  } catch (err) {
    console.error('Erro ao registrar publicação manual:', err);
    alert('Erro de conexão ao salvar no histórico.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Marcar como Publicado Manualmente`;
  }
}
