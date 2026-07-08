const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let dbFirestore = null;
let storageBucket = null;
let firebaseInitialized = false;

// Tentar carregar credenciais do caminho configurado no .env ou do local padrão
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH 
  ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  : path.join(__dirname, 'firebase-service-account.json');

const bucketName = process.env.FIREBASE_STORAGE_BUCKET;

if (fs.existsSync(serviceAccountPath) && bucketName) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: bucketName
    });
    dbFirestore = admin.firestore();
    storageBucket = admin.storage().bucket();
    firebaseInitialized = true;
    console.log('[Firebase] Inicializado com sucesso em modo Nuvem.');
  } catch (err) {
    console.error('[Firebase] Erro ao inicializar Firebase:', err);
  }
} else {
  console.log('[Firebase] Arquivo de credenciais ou bucket não configurados. Rodando em modo LOCAL.');
}

module.exports = {
  admin,
  dbFirestore,
  storageBucket,
  isCloudEnabled: () => firebaseInitialized
};
