const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const optionsCors = require('./config/cors');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const { proteger, exigerMotDePasseAJour } = require('./middlewares/auth');
const { limiteurApi } = require('./middlewares/rateLimit');
const routes = require('./routes');
const stockage = require('./services/stockageService');
const { docsActives, routeurDocumentation } = require('./docs/swagger');

const app = express();
const PORT = process.env.PORT || 3000;

// Derrière un reverse proxy, TRUST_PROXY = nombre de proxys (ex. 1) pour que req.ip
// soit l'IP réelle du client (nécessaire à la limitation de débit).
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY, 10) || process.env.TRUST_PROXY);
}

// Application web sur un autre domaine / port : origines autorisées dans config/cors.js
app.use(cors(optionsCors));

// Middlewares intégrés
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger minimal des requêtes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Route de santé
app.get('/', (req, res) => {
  res.json({ message: 'API Centres Diagnostiques Hospitaliers - opérationnelle' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Routes métier
app.use('/api', limiteurApi);

// Documentation interactive (Swagger UI) sur /api/docs – désactivée par défaut en production
if (docsActives()) app.use('/api/docs', routeurDocumentation());

// Chaque route métier exige d'être connecté avec un mot de passe définitif (connecte),
// puis un rôle précis (autoriser, dans les fichiers de routes). Table de montage : routes/index.js
const connecte = [proteger, exigerMotDePasseAJour];
for (const { prefixe, routeur, publique } of routes) {
  app.use(`/api${prefixe}`, ...(publique ? [] : connecte), routeur);
}

// Route inexistante -> 404 normalisée
app.use(notFound);

// Gestionnaire d'erreurs global (doit rester en dernier)
app.use(errorHandler);

let server;
const demarrer = async () => {
  try {
    await connectDB();
    server = app.listen(PORT, () => {
      console.log(`Serveur démarré sur http://localhost:${PORT}`);
    });
    // Bucket MinIO (ou dossier local) créé s'il n'existe pas ; un échec est signalé sans bloquer l'API
    stockage.verifierAuDemarrage();
  } catch (err) {
    console.error('Échec du démarrage (MongoDB inaccessible) :', err.message);
    process.exit(1);
  }
};

demarrer();

// Erreurs hors cycle requête/réponse
process.on('unhandledRejection', (reason) => {
  console.error('Promesse rejetée non gérée :', reason);
  if (server) server.close(() => process.exit(1));
  else process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Exception non interceptée :', err);
  process.exit(1);
});

module.exports = app;
