const dotenv = require('dotenv');
dotenv.config();

const db = require('./databaseService');
const fs = require('fs');
const path = require('path');

const videosDir = db.getSettings().VIDEOS_DIR;

// Definir os horários em horário local do Brasil (-03:00) para o Lote 2
const baseSchedule = [
  { day: '2026-07-12', times: ['07:00', '12:30', '19:30'] },
  { day: '2026-07-13', times: ['07:00', '12:30', '19:30'] },
  { day: '2026-07-14', times: ['07:00', '12:30', '19:30'] },
  { day: '2026-07-15', times: ['07:00', '12:30', '19:30'] }
];

console.log('=== Iniciando Agendamento dos 12 Reels (Lote 2) ===');

// Preservar posts agendados do Lote 1 e filtrar apenas agendamentos futuros do Lote 2
const currentDb = db.read();
currentDb.schedule = (currentDb.schedule || []).filter(post => {
  const date = new Date(post.scheduledAt);
  // Mantém apenas o que for agendado para antes de 12 de julho de 2026
  return date < new Date('2026-07-12T00:00:00Z');
});
db.write(currentDb);
console.log('[DB] Fila filtrada para preservar agendamentos do Lote 1.');

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
