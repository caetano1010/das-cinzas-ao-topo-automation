const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');
const axios = require('axios');

// Carregar variáveis de ambiente
dotenv.config();

const workspaceRoot = 'd:/canais-dark/das-cinzas-ao-topo';
const rawVideosDir = path.join(workspaceRoot, 'Videos-brutos');
const readyVideosDir = process.env.VIDEOS_DIR || path.join(workspaceRoot, 'Videos-prontos-12-15-07-26');
const processedDir = path.join(workspaceRoot, '_archive', 'Videos-brutos-processados');
const logoPath = path.join(workspaceRoot, 'logo-oficial-sem-fundo.png');
const fontsDir = path.join(__dirname, 'fonts');

// Lista de Frases locales de Fallback (Cravadas exatamente para o Lote 2 de Conteúdo)
const fallbackQuotes = [
  {
    quoteLine1: "O verdadeiro progresso é esculpido na privacidade do seu esforço silencioso,",
    quoteLine2: "longe de qualquer aplauso ou validação,",
    quoteLine3: "enquanto a maioria desperdiça energia tentando provar o seu valor.",
    caption: "O homem que aprende a trabalhar na escuridão não depende de holofotes para manter-se firme. Foque na sua rotina invisível, pois o sucesso duradouro é construído longe do barulho. Deixe que os outros disputem a atenção vazia; o seu valor é medido por resultados silenciosos.\n\n#disciplina #estoicismo #foco #mentalidadeforte #dascinzasaotopo"
  },
  {
    quoteLine1: "Deseje o topo com toda a força da sua alma,",
    quoteLine2: "mas aprenda a governar sua mente com frieza estratégica,",
    quoteLine3: "pois o homem impulsivo sabota a própria escalada.",
    caption: "O desejo sem autocontrole é uma fraqueza. Para conquistar o topo, você precisa de uma mente fria que calcula os riscos e domina os impulsos. Mantenha a ambição no peito, mas a estratégia na cabeça. O homem impulsivo cai antes de alcançar a metade do caminho.\n\n#autocontrole #mentalidadeforte #estoicismo #disciplina #dascinzasaotopo"
  },
  {
    quoteLine1: "Não importa o tamanho da tempestade que te derrubou nas cinzas,",
    quoteLine2: "o que define seu caráter é a velocidade com que você se levanta",
    quoteLine3: "para marchar novamente.",
    caption: "Cair é inevitável; aceitar a derrota é uma escolha. O homem forte não teme o chão, pois sabe que cada queda é apenas o prelúdio de um recomeço ainda mais forte. Levante-se, limpe a poeira e continue marchando. O topo aguarda quem se recusa a ficar no chão.\n\n#superação #motivação #forçadecarater #disciplina #dascinzasaotopo"
  },
  {
    quoteLine1: "A empolgação momentânea acende o início da sua caminhada,",
    quoteLine2: "mas apenas a disciplina inflexível de fazer o necessário",
    quoteLine3: "garante que você permaneça firme no topo da montanha.",
    caption: "Motivação é o que te faz começar, mas a disciplina é o que te mantém de pé quando tudo dá errado. Não dependa de dias fáceis ou de sentimentos confortáveis. Domine a sua mente e faça o que precisa ser feito, com constância implacável.\n\n#disciplina #foco #habitos #mentalidadeforte #dascinzasaotopo"
  },
  {
    quoteLine1: "Mantenha seus olhos fixos nos objetivos de longo prazo",
    quoteLine2: "e ignore as distrações rápidas do caminho.",
    quoteLine3: "A paciência estratégica constrói legados que o tempo nunca apaga.",
    caption: "O homem que busca prazer rápido sabota o seu próprio futuro. Para construir algo grandioso, você precisa de foco de longo prazo e paciência estratégica. Ignore o barulho das distrações e comprometa-se com o processo. O seu legado está sendo forjado no silêncio de hoje.\n\n#estoicismo #legado #foco #compromisso #dascinzasaotopo"
  },
  {
    quoteLine1: "O homem de real valor prefere enfrentar a solidão de um deserto árido",
    quoteLine2: "do que sentar-se na mesa de quem não demonstra o devido respeito",
    quoteLine3: "por sua jornada.",
    caption: "A solidão com dignidade é uma fortaleza; a má companhia é uma prisão. Não tenha medo de afastar-se de quem diminui o seu valor ou desrespeita os seus objetivos. Construa o seu caminho no seu próprio tempo, mesmo que precise caminhar sozinho.\n\n#respeitoproprio #homem #reflexão #limites #dascinzasaotopo"
  },
  {
    quoteLine1: "Sua rotina secreta é a assinatura invisível do seu sucesso sob a luz.",
    quoteLine2: "Não procure plateia ou validação externa",
    quoteLine3: "enquanto estiver construindo sua fortaleza no escuro.",
    caption: "O progresso real é silencioso. Os hábitos que você pratica no escuro, quando ninguém está olhando, são as fundações da sua vitória pública. Pare de buscar aplausos precoces e concentre-se em construir sua estrutura com consistência diária.\n\n#disciplina #foco #trabalhoemsilencio #mentalidadeforte #dascinzasaotopo"
  },
  {
    quoteLine1: "Dominar a si mesmo é o maior poder que você pode alcançar.",
    quoteLine2: "Quem reage no impulso entrega as chaves da sua própria vida",
    quoteLine3: "nas mãos de qualquer provocador.",
    caption: "O autodomínio é a sua maior defesa. Quem te provoca e consegue te irritar, passa a controlar você. Não entregue o controle das suas ações nas mãos dos outros. Responda com silêncio, aja com estratégia e mantenha-se inabalável.\n\n#autodominio #frieza #estoicismo #estratégia #dascinzasaotopo"
  },
  {
    quoteLine1: "As marcas e cicatrizes do seu passado são troféus de batalhas vencidas.",
    quoteLine2: "Elas provam que você atravessou o inferno do sofrimento",
    quoteLine3: "e saiu dele ainda mais forte.",
    caption: "Não lamente as dificuldades que você enfrentou. Cada problema superado é um tijolo na construção da sua fortaleza mental. Suas cicatrizes são a prova de que a dor não foi capaz de te destruir. Você é o resultado da sua resiliência.\n\n#resiliencia #superação #força #mentalidadeforte #dascinzasaotopo"
  },
  {
    quoteLine1: "Não ore por uma jornada fácil ou por atalhos confortáveis.",
    quoteLine2: "Desenvolva a força de caráter necessária para suportar qualquer tempestade",
    quoteLine3: "e marchar até o fim.",
    caption: "Atalhos fáceis criam homens fracos. O que tem valor real exige esforço, suor e constância. Não queira que os problemas diminuam; queira ser forte o suficiente para passar por cima de todos eles. O seu caráter é forjado na tempestade.\n\n#disciplina #forçadecarater #superação #foco #dascinzasaotopo"
  },
  {
    quoteLine1: "A estabilidade emocional é a sua armadura nas horas de caos.",
    quoteLine2: "O homem estratégico observa em silêncio,",
    quoteLine3: "calcula friamente os riscos e age apenas com clareza absoluta.",
    caption: "No meio da tempestade, a calma é o seu superpoder. Não tome decisões sob o efeito de emoções temporárias. Respire, observe o cenário, calcule o seu próximo passo e age com frieza. O controle emocional decide quem vence no final.\n\n#autodominio #frieza #foco #estratégia #dascinzasaotopo"
  },
  {
    quoteLine1: "Aprenda a recolher sua presença em silêncio quando perceber",
    quoteLine2: "que seus valores não são correspondidos.",
    quoteLine3: "A ausência digna do homem forte constrange mais do que qualquer discussão.",
    caption: "O silêncio é a resposta mais forte para quem não sabe valorizar a sua presença. Não tente provar o seu valor discutindo ou implorando atenção. Recolha-se com dignidade e deixe que a sua ausência ensine o que as suas palavras não conseguiram.\n\n#reflexão #homem #estoicismo #limites #dascinzasaotopo"
  }
];

// Garantir que as pastas existam
if (!fs.existsSync(rawVideosDir)) {
  fs.mkdirSync(rawVideosDir, { recursive: true });
}
if (!fs.existsSync(readyVideosDir)) {
  fs.mkdirSync(readyVideosDir, { recursive: true });
}
if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

// Obter o próximo ID disponível para o vídeo pronto
function getNextVideoId() {
  const files = fs.readdirSync(readyVideosDir);
  let maxId = 0;
  files.forEach(file => {
    if (file.endsWith('.mp4')) {
      const name = path.basename(file, '.mp4');
      const id = parseInt(name);
      if (!isNaN(id) && id > maxId) {
        maxId = id;
      }
    }
  });
  return maxId + 1;
}

// Chamar a API do Gemini para gerar frase e legenda
// Retornar a frase local cravada para o Lote 2 de forma síncrona
async function generateAIPost(apiKey, index) {
  console.log(`  [Pauta Lote 2] Selecionando frase de pauta sequencial #${index + 1}`);
  return fallbackQuotes[index % fallbackQuotes.length];
}

function wrapText(text, maxCharsPerLine = 32) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

async function processVideos() {
  console.log('=== Iniciando Processamento de Vídeos Brutos ===');
  
  const videoFiles = fs.readdirSync(rawVideosDir).filter(f => f.endsWith('.mp4'));
  if (videoFiles.length === 0) {
    console.log(`Nenhum vídeo bruto encontrado em: ${rawVideosDir}`);
    return;
  }
  
  console.log(`Encontrados ${videoFiles.length} vídeos para processar.`);
  
  // Escolher a fonte tipográfica
  // Sempre preferir Montserrat-SemiBold.ttf para vídeos de alta visibilidade/motivação
  let fontName = 'Montserrat-SemiBold.ttf';
  let fontStyle = 'Montserrat';
  if (!fs.existsSync(path.join(fontsDir, 'Montserrat-SemiBold.ttf')) && fs.existsSync(path.join(fontsDir, 'CormorantGaramond-Regular.ttf'))) {
    fontName = 'CormorantGaramond-Regular.ttf';
    fontStyle = 'CormorantGaramond';
  }
  const fontFilePath = `fonts/${fontName}`; // Caminho relativo para evitar problemas de escape de D:/ no Windows
  console.log(`Usando a fonte: ${fontName} (${fontStyle})`);
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    console.log('Chave do Gemini encontrada. Usando geração dinâmica por IA.');
  } else {
    console.log('Chave do Gemini não configurada no .env. Usando banco de frases locais.');
  }

  for (let i = 0; i < videoFiles.length; i++) {
    const rawFile = videoFiles[i];
    const rawFilePath = path.join(rawVideosDir, rawFile);
    const nextId = getNextVideoId();
    
    const outputVideoName = `${nextId}.mp4`;
    const outputTxtName = `${nextId}.txt`;
    const outputVideoPath = path.join(readyVideosDir, outputVideoName);
    const outputTxtPath = path.join(readyVideosDir, outputTxtName);
    
    console.log(`\nProcessando [${i + 1}/${videoFiles.length}] : ${rawFile} -> Reels ID #${nextId}`);
    
    // 1. Obter conteúdo do post (passando o índice para seleção sequencial no fallback)
    const postContent = await generateAIPost(apiKey, i);
    
    // Concatenar e re-quebrar o texto de forma inteligente para evitar cortes laterais no Reels vertical
    const fullQuote = [postContent.quoteLine1, postContent.quoteLine2, postContent.quoteLine3]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
      
    // Limite máximo de 32 caracteres por linha garante que caiba na tela com folga nas bordas
    const wrappedLines = wrapText(fullQuote, 32);
    console.log(`  Frase Completa: "${fullQuote}"`);
    console.log(`  Linhas Quebradas (${wrappedLines.length}):`);
    wrappedLines.forEach((l, idx) => console.log(`    L${idx + 1}: "${l}"`));
    
    // 2. Montar filtros do FFmpeg para cada linha de forma centralizada verticalmente
    const lineHeight = 52; // Espaçamento vertical entre linhas
    const totalH = wrappedLines.length * lineHeight;
    const yStart = 1300 - (totalH / 2); // Centralizado verticalmente em y=1300 (região do peito/pescoço do soldado)
    
    const drawtextFilters = wrappedLines.map((line, index) => {
      const lineEscaped = line.replace(/'/g, "'\\\\''").replace(/:/g, '\\:');
      const yPos = Math.round(yStart + (index * lineHeight));
      // Fonte Montserrat-SemiBold tamanho 36, com contorno preto grosso (borderw=2.0) para legibilidade absoluta
      return `drawtext=fontfile='${fontFilePath}':text='${lineEscaped}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=${yPos}:borderw=2.0:bordercolor=black:shadowcolor=black@0.4:shadowx=1.5:shadowy=1.5`;
    });
    
    const drawtextFilter = drawtextFilters.join(',');
    
    // Aplicar crop e scale na entrada de vídeo para remover a marca d'água "Veo" da base mantendo a proporção 9:16 sem distorcer
    const cropScaleFilter = `crop=(in_h-180)*9/16:in_h-180:(in_w-ow)/2:0,scale=1080:1920`;

    // Filtro complexo com marca d'água da logo se existir
    let filterComplex = '';
    let command = '';
    
    if (fs.existsSync(logoPath)) {
      const logoPathEscaped = logoPath.replace(/\\/g, '/');
      console.log('  Logo encontrada. Aplicando marca d\'água sólida e removendo marca "Veo"...');
      // 1. Aplicar crop e scale no vídeo de entrada [0:v]
      // 2. Redimensionar logo para 140px de largura e amplificar canal alpha para opacidade de 100% [1:v]
      // 3. Aplicar drawtext no vídeo cropped e scaled
      // 4. Sobrepor logo a 150px do rodapé
      filterComplex = `[0:v]${cropScaleFilter}[cropped];[1:v]scale=140:-1,format=rgba,lut=a='val*3'[logo];[cropped]${drawtextFilter}[bg];[bg][logo]overlay=(W-w)/2:H-h-150`;
      command = `ffmpeg -y -i "${rawFilePath}" -i "${logoPathEscaped}" -filter_complex "${filterComplex}" -map 0:a? -c:a aac "${outputVideoPath}"`;
    } else {
      console.log('  Logo não encontrada. Removendo marca "Veo" e aplicando texto...');
      filterComplex = `[0:v]${cropScaleFilter},${drawtextFilter}`;
      command = `ffmpeg -y -i "${rawFilePath}" -filter_complex "${filterComplex}" -map 0:a? -c:a aac "${outputVideoPath}"`;
    }
    
    // 3. Executar edição
    try {
      console.log('  Executando FFmpeg...');
      execSync(command, { stdio: 'ignore' });
      
      // Gravar arquivo de legenda
      fs.writeFileSync(outputTxtPath, postContent.caption, 'utf-8');
      console.log(`  [Sucesso] Vídeo e legenda salvos!`);
      
      // Mover arquivo bruto original para a pasta de processados
      const destProcessedPath = path.join(processedDir, rawFile);
      // Se já existir no destino, remove para evitar erro de movimentação
      if (fs.existsSync(destProcessedPath)) {
        fs.unlinkSync(destProcessedPath);
      }
      fs.renameSync(rawFilePath, destProcessedPath);
      console.log(`  [Mover] Vídeo bruto movido para: _archive/Videos-brutos-processados/${rawFile}`);
    } catch (err) {
      console.error(`  [Erro] Falha ao processar o vídeo:`, err.message);
    }
  }
  
  console.log('\n=== Processamento Concluído! ===');
}

processVideos();
