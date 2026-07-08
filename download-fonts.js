const fs = require('fs');
const path = require('path');
const axios = require('axios');

const fonts = [
  {
    name: 'Montserrat-SemiBold.ttf',
    url: 'https://raw.githubusercontent.com/julietaula/montserrat/master/fonts/ttf/Montserrat-SemiBold.ttf'
  },
  {
    name: 'CormorantGaramond-Regular.ttf',
    url: 'https://raw.githubusercontent.com/tvldz/storybook/main/CormorantGaramond-Regular.ttf'
  }
];

const fontsDir = path.join(__dirname, 'fonts');

async function downloadFonts() {
  console.log('=== Iniciando download de fontes ===');
  for (const font of fonts) {
    const dest = path.join(fontsDir, font.name);
    console.log(`Baixando ${font.name} de: ${font.url}`);
    try {
      const response = await axios({
        method: 'GET',
        url: font.url,
        responseType: 'stream',
        timeout: 10000
      });
      
      const writer = fs.createWriteStream(dest);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      console.log(`  [Sucesso] Fonte salva em: ${font.name}`);
    } catch (err) {
      console.error(`  [Erro] Falha ao baixar ${font.name}:`, err.message);
    }
  }
  console.log('=== Processo concluído ===');
}

downloadFonts();
