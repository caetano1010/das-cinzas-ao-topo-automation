const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const execucoesDir = 'd:/canais-dark/das-cinzas-ao-topo/inteligencia-competitiva/execucoes';
const outputDir = path.join(__dirname, 'public', 'audios');

// Criar pasta de saída se não existir
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('=== Iniciando Extrator de Áudios Virais ===');
console.log(`Buscando em: ${execucoesDir}`);
console.log(`Salvando em: ${outputDir}\n`);

if (!fs.existsSync(execucoesDir)) {
  console.error('[Erro] Pasta de execuções não encontrada!');
  process.exit(1);
}

// Helper para buscar arquivos recursivamente
function findVideoFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findVideoFiles(filePath, filesList);
    } else if (file === '01.mp4') {
      filesList.push(filePath);
    }
  });
  
  return filesList;
}

try {
  const videoFiles = findVideoFiles(execucoesDir);
  console.log(`Encontrados ${videoFiles.length} vídeos de concorrentes para processar.`);

  let successCount = 0;
  let failCount = 0;

  videoFiles.forEach((videoPath, index) => {
    // Tentar extrair o nome do concorrente e shortcode do caminho
    // Caminho esperado: .../vencedores/[concorrente]/reels/[shortcode]/01.mp4
    const parts = videoPath.split(path.sep);
    
    let competitorName = 'concorrente';
    let shortcode = `audio_${index}`;
    
    // Achar a posição de "vencedores" no caminho para se situar
    const vencedoresIdx = parts.indexOf('vencedores');
    if (vencedoresIdx !== -1 && parts.length > vencedoresIdx + 3) {
      competitorName = parts[vencedoresIdx + 1];
      shortcode = parts[vencedoresIdx + 3];
    } else {
      // Fallback se o caminho não bater com o esperado
      // Tentar pegar do formato de barras normais /
      const normalizedParts = videoPath.replace(/\\/g, '/').split('/');
      const normVencedoresIdx = normalizedParts.indexOf('vencedores');
      if (normVencedoresIdx !== -1 && normalizedParts.length > normVencedoresIdx + 3) {
        competitorName = normalizedParts[normVencedoresIdx + 1];
        shortcode = normalizedParts[normVencedoresIdx + 3];
      }
    }

    const outputFileName = `${competitorName}_${shortcode}.mp3`;
    const outputPath = path.join(outputDir, outputFileName);

    console.log(`[${index + 1}/${videoFiles.length}] Processando: ${competitorName} (Reel: ${shortcode})`);

    try {
      // Executar o FFmpeg para extrair áudio
      // -y sobrescreve se já existir
      // -q:a 0 qualidade máxima VBR
      // -map a mapeia apenas a faixa de áudio
      const cmd = `ffmpeg -y -i "${videoPath}" -q:a 0 -map a "${outputPath}"`;
      execSync(cmd, { stdio: 'ignore' });
      
      console.log(`  -> Sucesso: ${outputFileName}`);
      successCount++;
    } catch (err) {
      console.error(`  -> [Erro] Falha ao extrair áudio de ${shortcode}:`, err.message);
      failCount++;
    }
  });

  console.log('\n=== Processo Concluído ===');
  console.log(`Áudios extraídos com sucesso: ${successCount}`);
  console.log(`Falhas: ${failCount}`);
  console.log(`Todos os áudios estão salvos em: ${outputDir}`);

} catch (err) {
  console.error('[Erro] Ocorreu um erro geral no script:', err.message);
}
