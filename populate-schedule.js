const db = require('./databaseService');
const fs = require('fs');
const path = require('path');

const videosDir = db.getSettings().VIDEOS_DIR;

// Definir os horários em horário local do Brasil (-03:00)
const baseSchedule = [
  { day: '2026-07-08', times: ['07:00', '12:30', '19:30'] },
  { day: '2026-07-09', times: ['07:00', '12:30', '19:30'] },
  { day: '2026-07-10', times: ['07:00', '12:30', '19:30'] },
  { day: '2026-07-11', times: ['07:00', '12:30', '19:30'] }
];

console.log('=== Iniciando Agendamento dos 12 Reels ===');

// Limpar agendamentos anteriores para evitar bagunça
const currentDb = db.read();
currentDb.schedule = [];
db.write(currentDb);
console.log('[DB] Fila de agendamento limpa.');

let scheduledCount = 0;

for (let i = 1; i <= 12; i++) {
  const fileName = `${i}.mp4`;
  const txtName = `${i}.txt`;
  const videoPath = path.join(videosDir, fileName);
  const txtPath = path.join(videosDir, txtName);

  if (!fs.existsSync(videoPath)) {
    console.error(`[Erro] Vídeo ${fileName} não encontrado na pasta ${videosDir}`);
    continue;
  }

  let caption = '';
  if (fs.existsSync(txtPath)) {
    caption = fs.readFileSync(txtPath, 'utf-8');
  }

  // Calcular índice do dia e do horário
  const dayIndex = Math.floor((i - 1) / 3);
  const timeIndex = (i - 1) % 3;
  
  const day = baseSchedule[dayIndex].day;
  const time = baseSchedule[dayIndex].times[timeIndex];
  
  // Criar data no formato ISO8601 respeitando o fuso horário de Brasília (-03:00)
  const scheduledAtLocal = `${day}T${time}:00-03:00`;
  const scheduledAt = new Date(scheduledAtLocal).toISOString();

  const post = {
    id: '_' + Math.random().toString(36).substr(2, 9),
    videoId: String(i),
    fileName,
    caption,
    postInstagram: true,
    postFacebook: true,
    postTrial: false,
    isAiGenerated: true,
    status: 'Agendado',
    scheduledAt,
    createdAt: new Date().toISOString(),
    publishedAt: null,
    error: null,
    metaData: {}
  };

  db.addSchedule(post);
  console.log(`[Sucesso] Reel #${i} agendado para: ${day} às ${time} (UTC: ${scheduledAt})`);
  scheduledCount++;
}

console.log(`\n=== Agendamento Concluído! ${scheduledCount} Reels agendados. ===`);
