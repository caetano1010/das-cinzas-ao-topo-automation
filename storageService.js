const fs = require('fs');
const path = require('path');
const firebase = require('./firebaseService');

class StorageService {
  getVideosDirectory() {
    return process.env.VIDEOS_DIR || 'd:/canais-dark/das-cinzas-ao-topo/Videos-prontos-03-06-26';
  }

  // Listar vídeos e as legendas associadas
  listVideos() {
    const videosDir = this.getVideosDirectory();
    
    if (!fs.existsSync(videosDir)) {
      throw new Error(`Pasta de vídeos não encontrada no caminho: ${videosDir}`);
    }

    const files = fs.readdirSync(videosDir);
    const videos = [];

    files.forEach(file => {
      if (file.endsWith('.mp4')) {
        const id = path.basename(file, '.mp4');
        const txtFile = `${id}.txt`;
        let caption = '';

        if (files.includes(txtFile)) {
          try {
            caption = fs.readFileSync(path.join(videosDir, txtFile), 'utf-8');
          } catch (err) {
            console.error(`[Storage] Erro ao ler legenda do vídeo ${file}:`, err);
          }
        }

        videos.push({
          id,
          fileName: file,
          caption,
          url: `/videos/${file}`
        });
      }
    });

    // Ordenar os vídeos de forma numérica crescente (1, 2, 3...) em vez de alfabética (1, 10, 11, 12, 2...)
    videos.sort((a, b) => {
      const numA = parseInt(a.id, 10);
      const numB = parseInt(b.id, 10);
      if (isNaN(numA) || isNaN(numB)) {
        return a.id.localeCompare(b.id);
      }
      return numA - numB;
    });

    return videos;
  }

  // Fazer upload de um arquivo para o Firebase Storage e retornar sua URL pública
  async uploadToCloud(fileName, localFilePath) {
    if (!firebase.isCloudEnabled()) {
      throw new Error('Firebase não está configurado para operação em nuvem.');
    }

    const bucket = firebase.storageBucket;
    const destination = `videos/${fileName}`;

    console.log(`[Storage Cloud] Iniciando upload de ${fileName} para Firebase Storage...`);
    
    // Fazer upload do arquivo
    await bucket.upload(localFilePath, {
      destination,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      }
    });

    console.log(`[Storage Cloud] Upload concluído. Gerando link público...`);

    // Obter URL pública válida por 10 anos
    const file = bucket.file(destination);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2036' // Expira em 2036
    });

    console.log(`[Storage Cloud] URL assinada gerada com sucesso.`);
    return url;
  }
}

module.exports = new StorageService();
