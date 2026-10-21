/**
 * Raccourcis pour écrire la spécification OpenAPI sans répéter les mêmes blocs.
 * Toutes les réponses de l'API suivent le format { success: true, data, … } ou { success: false, error }.
 */

const ref = (nom) => ({ $ref: `#/components/schemas/${nom}` });
const liste = (schema) => ({ type: 'array', items: schema });

/** Enveloppe de succès : { success: true, data, …champs supplémentaires }. */
const enveloppe = (data, supplementaires = {}) => ({
  type: 'object',
  required: ['success'],
  properties: { success: { type: 'boolean', example: true }, ...(data && { data }), ...supplementaires },
});

/** Réponse JSON de succès. */
const ok = (description, data, supplementaires) => ({
  description,
  content: { 'application/json': { schema: enveloppe(data, supplementaires) } },
});

/** Réponse JSON de succès avec un simple message. */
const message = (description, exemple) => ok(description, null, { message: { type: 'string', example: exemple } });

/** Réponses d'erreur communes, par code HTTP. */
const erreurs = (...codes) => Object.fromEntries(codes.map((c) => [String(c), { $ref: `#/components/responses/E${c}` }]));

/** Corps de requête JSON. */
const corps = (schema, exemple) => ({
  required: true,
  content: { 'application/json': { schema, ...(exemple && { example: exemple }) } },
});

/** Corps multipart avec un fichier dans le champ « fichier ». */
const fichier = (description) => ({
  required: true,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object',
        required: ['fichier'],
        properties: { fichier: { type: 'string', format: 'binary', description } },
      },
    },
  },
});

/** Réponse binaire (téléchargement). */
const telechargement = (description, types) => ({
  description,
  headers: { 'Content-Disposition': { schema: { type: 'string' }, description: 'attachment; filename="…"' } },
  content: Object.fromEntries(types.map((t) => [t, { schema: { type: 'string', format: 'binary' } }])),
});

const parametreId = (description = 'Identifiant (ObjectId)') => ({
  in: 'path', name: 'id', required: true, description, schema: ref('ObjectId'),
});

const requete = (name, description, schema = { type: 'string' }) => ({
  in: 'query', name, ...(description && { description }), schema,
});

/** Phrase « Rôles : … » ajoutée en tête de la description d'une opération. */
const roles = (...liste) => `**Rôles :** ${liste.join(', ')}.`;

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

module.exports = {
  ref, liste, enveloppe, ok, message, erreurs, corps, fichier, telechargement, parametreId, requete, roles, XLSX,
};
