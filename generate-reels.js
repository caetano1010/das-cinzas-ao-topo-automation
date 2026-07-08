const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');
const axios = require('axios');

// Carregar variáveis de ambiente
dotenv.config();

const workspaceRoot = 'd:/canais-dark/das-cinzas-ao-topo';
const rawVideosDir = path.join(workspaceRoot, 'Videos-brutos');
const readyVideosDir = path.join(workspaceRoot, 'Videos-prontos-03-06-26');
const processedDir = path.join(workspaceRoot, '_archive', 'Videos-brutos-processados');
const logoPath = path.join(workspaceRoot, 'logo-oficial-sem-fundo.png');
const fontsDir = path.join(__dirname, 'fonts');

// Lista de Frases locales de Fallback (Altamente curadas baseadas na pesquisa competitiva)
const fallbackQuotes = [
  {
    quoteLine1: "Existe um poder que poucos percebem:",
    quoteLine2: "o de não precisar provar nada para ninguém.",
    caption: "Quando você encontra o seu próprio centro, a opinião do mundo exterior perde todo o poder sobre você. Não busque validação, busque progresso silencioso.\n\n#mentalidadeinabalavel #autodominio #estoicismo #silencio #dascirzasaotopo"
  },
  {
    quoteLine1: "Sorria, seja educado e trate todos bem.",
    quoteLine2: "Mas nunca seja ingênuo com quem caminha ao seu lado.",
    caption: "Educação é uma marca de respeito próprio, mas a ingenuidade é fraqueza. Saiba ler as intenções das pessoas e proteja seus planos do barulho alheio.\n\n#condutamasculina #respeito #limites #foco #homemdevalor"
  },
  {
    quoteLine1: "A solidão só assusta quem ainda não descobriu",
    quoteLine2: "que a própria companhia pode ser uma fortaleza.",
    caption: "Estar sozinho não é isolamento, é preparação. É no silêncio da sua própria companhia que você reconstrói sua mente e foca no que realmente importa.\n\n#crescimento #solidao #forçamental #disciplina #dascirzasaotopo"
  },
  {
    quoteLine1: "A maior ironia de se tornar inabalável",
    quoteLine2: "é que o mundo passa a ignorar as suas tempestades.",
    caption: "Quando você para de reclamar e começa a agir, as dificuldades param de te abalar. O homem forte enfrenta o caos com a mente calma e estruturada.\n\n#resiliencia #superacao #foco #firmeza #estoico"
  },
  {
    quoteLine1: "A mente fraca reage a qualquer provocação.",
    quoteLine2: "A mente forte observa, calcula e age com clareza.",
    caption: "Não entregue o controle das suas emoções para os outros. Quem te provoca e consegue te irritar, passa a governar você. Escolha a serenidade e a estratégia.\n\n#autocontrole #inteligênciaemocional #estratégia #mentalidade #conduta"
  },
  {
    quoteLine1: "O preço da disciplina dura apenas alguns anos.",
    quoteLine2: "O peso do arrependimento vai durar a vida inteira.",
    caption: "A dor do esforço diário é passageira, mas a frustração de olhar para trás e saber que você poderia ter feito melhor é permanente. Escolha o seu peso hoje.\n\n#disciplinadiaria #habitos #sucesso #foco #compromisso"
  },
  {
    quoteLine1: "Não fale sobre planos com pessoas",
    quoteLine2: "que não conhecem o peso da sua escalada.",
    caption: "Projetos grandes devem ser gerados no escuro. Falar demais dissipa sua energia e atrai o julgamento de quem se recusa a sair do conforto. Trabalhe em silêncio.\n\n#trabalhoemsilencio #privacidade #foco #legado #crescimento"
  },
  {
    quoteLine1: "Erga-se de vez das suas próprias cinzas.",
    quoteLine2: "Onde eles vêem o fim, você encontra o recomeço.",
    caption: "O erro ou a derrota não definem quem você é. O que define a sua trajetória é a força com a qual você decide se levantar e marchar até o topo.\n\n#recomeço #superação #forçadecarater #disciplina #dascirzasaotopo"
  },
  {
    quoteLine1: "Quem vive buscando a aprovação alheia",
    quoteLine2: "se torna prisioneiro de qualquer comentário.",
    caption: "Se você precisa que os outros batam palmas para se sentir valorizado, você nunca será livre. Encontre sua própria aprovação na sua conduta diária.\n\n#liberdademental #autodominio #respeito #personalidade #homemdevalor"
  },
  {
    quoteLine1: "Enquanto eles procuram atalhos fáceis,",
    quoteLine2: "construa seu legado sobre o esforço invisível.",
    caption: "Atalhos rápidos geram conquistas frágeis. O que tem valor real leva tempo, exige suor e é forjado longe dos holofotes. Comprometa-se com a constância.\n\n#constancia #trabalhodevalor #sucesso #legado #compromisso"
  },
  {
    quoteLine1: "A dor de hoje está apenas construindo",
    quoteLine2: "a estrutura que você precisa ter no topo.",
    caption: "Não ore por uma vida sem problemas; busque ser um homem forte o suficiente para superar qualquer obstáculo. A dificuldade é o seu treinamento.\n\n#superaçao #treinamentomental #força #condutadehomem #foco"
  },
  {
    quoteLine1: "O silêncio é a moldura da verdadeira força.",
    quoteLine2: "Deixe que os seus resultados falem por você.",
    caption: "Promessas e discursos não mudam realidades. Suas ações diárias e seus resultados finais são a única prova de valor que realmente importa. Mova-se em silêncio.\n\n#ações #resultados #silencio #foco #condutadiaria"
  }
];

// Garantir que as pastas existam
if (!fs.existsSync(rawVideosDir)) {
  fs.mkdirSync(rawVideosDir, { recursive: true });
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
async function generateAIPost(apiKey, index) {
  const prompt = `Escreva uma frase curta de alto impacto em português para um Instagram Reel sobre desenvolvimento pessoal masculino, disciplina ou mentalidade. A frase deve ter no máximo 2 linhas e no total 15 a 18 palavras. Também escreva uma legenda correspondente para o post do Instagram, com 2 a 3 parágrafos curtos e 4 a 5 hashtags estratégicas.
  
  Retorne a resposta EXCLUSIVAMENTE em formato JSON com esta estrutura:
  {
    "quoteLine1": "linha 1 da frase",
    "quoteLine2": "linha 2 da frase (opcional)",
    "caption": "conteúdo da legenda completo com as hashtags"
  }`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      },
      { timeout: 10000 }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      return JSON.parse(text);
    }
    throw new Error('Resposta vazia da API do Gemini');
  } catch (err) {
    console.warn('  [Aviso] Falha ao chamar API do Gemini ou chave ausente, usando frase de fallback local sequencial.');
    // Selecionar sequencialmente para garantir variedade sem repetição nos 12 vídeos
    return fallbackQuotes[index % fallbackQuotes.length];
  }
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
    console.log(`  Texto Linha 1: "${postContent.quoteLine1}"`);
    console.log(`  Texto Linha 2: "${postContent.quoteLine2 || ''}"`);
    
    // 2. Montar filtros do FFmpeg (mantendo a capitalização original da frase)
    const line1Escaped = postContent.quoteLine1.replace(/'/g, "'\\\\''").replace(/:/g, '\\:');
    const line2Escaped = (postContent.quoteLine2 || '').replace(/'/g, "'\\\\''").replace(/:/g, '\\:');
    
    // Construir drawtext com estilo "clean" (tamanho 32, borda fina 1.5 e sombra sutil, com espaçamento menor)
    let drawtextFilter = '';
    if (line2Escaped) {
      drawtextFilter = `drawtext=fontfile='${fontFilePath}':text='${line1Escaped}':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=(h-text_h)/2-20:borderw=1.5:bordercolor=black:shadowcolor=black@0.4:shadowx=1.5:shadowy=1.5`;
      drawtextFilter += `,drawtext=fontfile='${fontFilePath}':text='${line2Escaped}':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=(h-text_h)/2+20:borderw=1.5:bordercolor=black:shadowcolor=black@0.4:shadowx=1.5:shadowy=1.5`;
    } else {
      drawtextFilter = `drawtext=fontfile='${fontFilePath}':text='${line1Escaped}':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=(h-text_h)/2:borderw=1.5:bordercolor=black:shadowcolor=black@0.4:shadowx=1.5:shadowy=1.5`;
    }
    
    // Aplicar crop e scale na entrada de vídeo para remover a marca d'água "Veo" da base mantendo a proporção 9:16 sem distorcer
    const cropScaleFilter = `crop=(in_h-180)*9/16:in_h-180:(in_w-ow)/2:0,scale=1080:1920`;

    // Filtro complexo com marca d'água da logo se existir
    let filterComplex = '';
    let command = '';
    
    if (fs.existsSync(logoPath)) {
      const logoPathEscaped = logoPath.replace(/\\/g, '/');
      console.log('  Logo encontrada. Aplicando marca d\'água e removendo marca "Veo"...');
      // 1. Aplicar crop e scale no vídeo de entrada [0:v]
      // 2. Redimensionar logo para 140px de largura [1:v]
      // 3. Aplicar drawtext no vídeo cropped e scaled
      // 4. Sobrepor logo a 150px do rodapé
      filterComplex = `[0:v]${cropScaleFilter}[cropped];[1:v]scale=140:-1[logo];[cropped]${drawtextFilter}[bg];[bg][logo]overlay=(W-w)/2:H-h-150`;
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
