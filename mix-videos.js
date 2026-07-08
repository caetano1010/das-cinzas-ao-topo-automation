const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const videosDir = 'd:/canais-dark/das-cinzas-ao-topo/Videos-prontos-03-06-26';
const audiosDir = path.join(__dirname, 'public', 'audios');
const backupDir = path.join(videosDir, 'original-backup');

console.log('=== Iniciando Mixagem de Música nos Vídeos ===');
console.log(`Pasta de vídeos: ${videosDir}`);
console.log(`Pasta de áudios: ${audiosDir}`);
console.log(`Pasta de backup: ${backupDir}\n`);

// Criar pasta de backup se não existir
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
  console.log('[Backup] Pasta de backup criada com sucesso.');
}

try {
  // 1. Listar vídeos .mp4
  const videoFiles = fs.readdirSync(videosDir).filter(f => f.endsWith('.mp4'));
  if (videoFiles.length === 0) {
    console.log('[Info] Nenhum vídeo .mp4 encontrado na pasta.');
    process.exit(0);
  }
  console.log(`Encontrados ${videoFiles.length} vídeos para processar.`);

  // 2. Listar áudios .mp3
  if (!fs.existsSync(audiosDir)) {
    console.error('[Erro] Pasta de áudios não encontrada!');
    process.exit(1);
  }
  // Lista curada de 12 áudios virais 100% diferentes e sem duplicatas
  const audioFiles = [
    'blackandblood.co_DX2D2sDI-gB.mp3',
    'blackandblood.co_DXFxIWTCBn6.mp3',
    'conduta.dehomem_DWr-t-vEf32.mp3',
    'conduta.dehomem_DXQMNvCEf1g.mp3',
    'elevatemindsetofficial_DS73mF8jQph.mp3',
    'elevatemindsetofficial_DVhF3auCAOd.mp3',
    'moretohustle_DV1D9RkCkB1.mp3',
    'moretohustle_DV30c20imMd.mp3',
    'moretohustle_DVsbGh-CjH.mp3',
    'palavrasquevalemoficial_DW17VpRks92.mp3',
    'palavrasquevalemoficial_DW2I4nrEk9Q.mp3',
    'palavrasquevalemoficial_DXCo1ZNEoAA.mp3'
  ];
  console.log(`Usando lista curada com ${audioFiles.length} áudios 100% exclusivos.`);

  let successCount = 0;
  let failCount = 0;

  // Processar cada vídeo
  videoFiles.forEach((videoFile, index) => {
    const videoPath = path.join(videosDir, videoFile);
    const backupPath = path.join(backupDir, videoFile);

    console.log(`\n----------------------------------------`);
    console.log(`[${index + 1}/${videoFiles.length}] Processando: ${videoFile}`);

    // Fazer backup do vídeo original se ainda não houver
    if (!fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(videoPath, backupPath);
        console.log(`  [Backup] Vídeo original copiado para backup: ${videoFile}`);
      } catch (err) {
        console.error(`  [Erro] Falha ao fazer backup do vídeo ${videoFile}:`, err.message);
        failCount++;
        return;
      }
    } else {
      console.log(`  [Backup] Backup já existente para: ${videoFile}`);
    }

    // Selecionar áudio sequencialmente
    const audioFile = audioFiles[index % audioFiles.length];
    const audioPath = path.join(audiosDir, audioFile);
    const tempOutputPath = path.join(videosDir, `temp_${videoFile}`);

    console.log(`  [Mixer] Trilha selecionada: ${audioFile}`);

    try {
      // Obter duração do vídeo original usando ffprobe (do backup para garantir exatidão)
      const durationStr = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${backupPath}"`,
        { encoding: 'utf-8' }
      );
      const duration = parseFloat(durationStr.trim());

      if (isNaN(duration) || duration <= 0) {
        throw new Error('Não foi possível determinar a duração do vídeo.');
      }

      console.log(`  [Mixer] Duração do vídeo: ${duration.toFixed(2)}s`);

      // Calcular início do fade-out (3 segundos antes do fim)
      const fadeStart = Math.max(0, duration - 3);
      console.log(`  [Mixer] Aplicando fade-out de 3s iniciando em: ${fadeStart.toFixed(2)}s`);

      // Executar FFmpeg para mixar o áudio do backup para a pasta final
      // -map 0:v pega o vídeo do backup
      // -map 1:a pega o áudio selecionado
      // -c:v copy copia o stream do vídeo instantaneamente sem re-encodar
      // -shortest corta quando o vídeo acabar
      const cmd = `ffmpeg -y -i "${backupPath}" -i "${audioPath}" -c:v copy -map 0:v -c:a aac -shortest -filter_complex "[1:a]afade=t=out:st=${fadeStart}:d=3[a]" -map "[a]" "${tempOutputPath}"`;
      
      execSync(cmd, { stdio: 'ignore' });

      // Substituir o arquivo final no diretório principal pelo arquivo mixado temporário
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
      fs.renameSync(tempOutputPath, videoPath);

      console.log(`  [Sucesso] Vídeo com áudio salvo em: ${videoFile}`);
      successCount++;
    } catch (err) {
      console.error(`  [Erro] Falha ao processar ${videoFile}:`, err.message);
      if (fs.existsSync(tempOutputPath)) {
        try { fs.unlinkSync(tempOutputPath); } catch (e) {}
      }
      failCount++;
    }
  });

  console.log(`\n========================================`);
  console.log('=== Processo de Mixagem Concluído ===');
  console.log(`Vídeos processados com sucesso: ${successCount}`);
  console.log(`Falhas: ${failCount}`);
  console.log(`Backup dos originais salvo em: ${backupDir}`);

} catch (err) {
  console.error('[Erro Geral]', err.message);
}
