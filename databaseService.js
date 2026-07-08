const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const firebase = require('./firebaseService');

const DB_PATH = path.join(__dirname, 'database.json');
const ENV_PATH = path.join(__dirname, '.env');

// Inicializar banco se não existir
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ posts: [], schedule: [] }, null, 2), 'utf-8');
}

class DatabaseService {
  constructor() {
    this.dbPath = DB_PATH;
  }

  // --- MÉTODOS GENÉRICOS ---
  read() {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error('[DB] Erro ao ler banco local:', err);
      return { posts: [], schedule: [] };
    }
  }

  write(data) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[DB] Erro ao gravar no banco local:', err);
      return false;
    }
  }

  // --- AGENDAMENTOS (SCHEDULE) ---
  async getSchedule() {
    if (firebase.isCloudEnabled()) {
      try {
        const snapshot = await firebase.dbFirestore.collection('schedule').get();
        const list = [];
        snapshot.forEach(doc => {
          list.push(doc.data());
        });
        return list;
      } catch (err) {
        console.error('[DB Cloud] Erro ao buscar schedule no Firestore:', err);
        return [];
      }
    }
    const db = this.read();
    return db.schedule || [];
  }

  async addSchedule(post) {
    if (firebase.isCloudEnabled()) {
      try {
        await firebase.dbFirestore.collection('schedule').doc(post.id).set(post);
        return post;
      } catch (err) {
        console.error('[DB Cloud] Erro ao adicionar no Firestore:', err);
        return post;
      }
    }
    const db = this.read();
    db.schedule.push(post);
    this.write(db);
    return post;
  }

  async updateScheduleStatus(id, status, error = null, publishedAt = null, metaData = {}) {
    if (firebase.isCloudEnabled()) {
      try {
        const docRef = firebase.dbFirestore.collection('schedule').doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
          const post = doc.data();
          post.status = status;
          post.error = error;
          if (publishedAt) post.publishedAt = publishedAt;
          if (metaData) post.metaData = metaData;

          if (status === 'Publicado' || status === 'Erro') {
            // Salvar no histórico
            await firebase.dbFirestore.collection('posts').doc(id).set(post);
            // Deletar da agenda
            await docRef.delete();
          } else {
            await docRef.set(post);
          }
          return post;
        }
      } catch (err) {
        console.error('[DB Cloud] Erro ao atualizar status no Firestore:', err);
      }
      return null;
    }

    const db = this.read();
    const postIndex = db.schedule.findIndex(p => p.id === id);
    if (postIndex !== -1) {
      const post = db.schedule[postIndex];
      post.status = status;
      post.error = error;
      if (publishedAt) post.publishedAt = publishedAt;
      if (metaData) post.metaData = metaData;
      
      // Se estiver publicado ou com erro final, movemos para o histórico de posts
      if (status === 'Publicado' || status === 'Erro') {
        db.posts.push(post);
        db.schedule = db.schedule.filter(p => p.id !== id);
      }
      this.write(db);
      return post;
    }
    return null;
  }

  async deleteSchedule(id) {
    if (firebase.isCloudEnabled()) {
      try {
        await firebase.dbFirestore.collection('schedule').doc(id).delete();
        return true;
      } catch (err) {
        console.error('[DB Cloud] Erro ao deletar no Firestore:', err);
        return false;
      }
    }
    const db = this.read();
    db.schedule = db.schedule.filter(p => p.id !== id || p.status !== 'Agendado');
    this.write(db);
    return true;
  }

  // --- POSTS PUBLICADOS (HISTÓRICO) ---
  async getPosts() {
    if (firebase.isCloudEnabled()) {
      try {
        const snapshot = await firebase.dbFirestore.collection('posts').get();
        const list = [];
        snapshot.forEach(doc => {
          list.push(doc.data());
        });
        return list;
      } catch (err) {
        console.error('[DB Cloud] Erro ao buscar posts no Firestore:', err);
        return [];
      }
    }
    const db = this.read();
    return db.posts || [];
  }

  // --- CONFIGURAÇÕES (SETTINGS) ---
  getSettings() {
    return {
      META_APP_ID: process.env.META_APP_ID || '',
      META_APP_SECRET: process.env.META_APP_SECRET || '',
      META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN || '',
      INSTAGRAM_ACCOUNT_ID: process.env.INSTAGRAM_ACCOUNT_ID || '',
      FACEBOOK_PAGE_ID: process.env.FACEBOOK_PAGE_ID || '',
      PORT: process.env.PORT || '3000',
      VIDEOS_DIR: process.env.VIDEOS_DIR || 'd:/canais-dark/das-cinzas-ao-topo/Videos-prontos-03-06-26'
    };
  }

  saveSettings(settings) {
    // 1. Atualizar em memória
    process.env.META_APP_ID = settings.META_APP_ID || '';
    process.env.META_APP_SECRET = settings.META_APP_SECRET || '';
    process.env.META_ACCESS_TOKEN = settings.META_ACCESS_TOKEN || '';
    process.env.INSTAGRAM_ACCOUNT_ID = settings.INSTAGRAM_ACCOUNT_ID || '';
    process.env.FACEBOOK_PAGE_ID = settings.FACEBOOK_PAGE_ID || '';
    
    // 2. Gravar no arquivo .env
    const envContent = [
      `META_APP_ID=${settings.META_APP_ID || ''}`,
      `META_APP_SECRET=${settings.META_APP_SECRET || ''}`,
      `META_ACCESS_TOKEN=${settings.META_ACCESS_TOKEN || ''}`,
      `INSTAGRAM_ACCOUNT_ID=${settings.INSTAGRAM_ACCOUNT_ID || ''}`,
      `FACEBOOK_PAGE_ID=${settings.FACEBOOK_PAGE_ID || ''}`,
      `PORT=${settings.PORT || process.env.PORT || 3000}`,
      `VIDEOS_DIR=${settings.VIDEOS_DIR || process.env.VIDEOS_DIR || 'd:/canais-dark/das-cinzas-ao-topo/Videos-prontos-03-06-26'}`
    ].join('\n');

    try {
      fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
      return { success: true, message: 'Configurações salvas no arquivo .env' };
    } catch (err) {
      console.error('[Config] Erro ao salvar arquivo .env:', err);
      return { success: false, message: 'Erro ao gravar arquivo de configuração local.' };
    }
  }
}

module.exports = new DatabaseService();
