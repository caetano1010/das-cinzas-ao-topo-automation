const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const path = require('path');
const fs = require('fs');

let dbFirestore = null;
let storageBucket = null;
let firebaseInitialized = false;

let serviceAccount = null;
const bucketName = process.env.FIREBASE_STORAGE_BUCKET;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && bucketName) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log('[Firebase] Carregando credenciais via variável de ambiente JSON.');
  } catch (err) {
    console.error('[Firebase] Erro ao analisar FIREBASE_SERVICE_ACCOUNT_JSON:', err);
  }
} else {
  // Tentar carregar do arquivo local
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH 
    ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : path.join(__dirname, 'firebase-service-account.json');

  if (fs.existsSync(serviceAccountPath) && bucketName) {
    try {
      serviceAccount = require(serviceAccountPath);
      console.log('[Firebase] Carregando credenciais via arquivo local.');
    } catch (err) {
      console.error('[Firebase] Erro ao ler arquivo de credenciais local:', err);
    }
  }
}

if (serviceAccount && bucketName) {
  try {
    const app = initializeApp({
      credential: cert(serviceAccount),
      storageBucket: bucketName
    });
    dbFirestore = getFirestore(app);
    storageBucket = getStorage(app).bucket();
    firebaseInitialized = true;
    console.log('[Firebase] Inicializado com sucesso em modo Nuvem.');
  } catch (err) {
    console.error('[Firebase] Erro ao inicializar Firebase:', err);
  }
} else {
  console.log('[Firebase] Arquivo de credenciais ou bucket não configurados. Rodando em modo LOCAL.');
}

module.exports = {
  dbFirestore,
  storageBucket,
  isCloudEnabled: () => firebaseInitialized
};
