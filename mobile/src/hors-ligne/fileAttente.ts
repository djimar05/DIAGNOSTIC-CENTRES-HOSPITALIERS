import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { api, ErreurApi, ErreurReseau, messageErreur } from '@/api/client';
import type { Reponse } from '@/api/types';
import * as coffre from './coffre';

/**
 * File d'attente locale (chiffrée) des réponses et photos à envoyer.
 * Chaque saisie y entre d'abord, puis part vers le serveur dès que possible :
 * une coupure de réseau ou une batterie vide ne fait rien perdre, l'envoi reprend tout seul.
 *
 *   - photo   : envoyée avec son identifiant client (le serveur ignore un second envoi identique)
 *   - réponse : la plus récente par critère remplace la précédente ; elle attend que ses photos soient parties
 *   - serveur injoignable : on arrête et on réessaiera plus tard
 *   - autre échec (erreur serveur 5xx, fichier illisible…) : l'erreur est notée sur l'élément, on réessaiera,
 *     et les éléments suivants partent quand même (un élément en échec ne bloque pas toute la file)
 *   - refus du serveur (4xx) : l'élément est bloqué et signalé
 */

export type Statut = 'attente' | 'bloque';

type Commun = { id: string; evaluationId: string; critereCode: string; creeLe: string; statut: Statut; erreur?: string };
export type ElementReponse = Commun & { type: 'reponse'; reponse: Reponse };
export type ElementPhoto = Commun & {
  type: 'photo'; clientId: string; prisLe: string;
  gps?: { longitude: number; latitude: number; precision?: number | null };
};
export type Element = ElementReponse | ElementPhoto;

type Index = { elements: Element[]; correspondances: Record<string, string> }; // photo locale → identifiant serveur

export const PREFIXE_LOCAL = 'local:';
const FICHIER_INDEX = 'file-attente.json';
const nomPhoto = (id: string) => `photo-${id}.enc`;

let index: Index = { elements: [], correspondances: {} };
let chargement: Promise<void> | null = null;
let envoiEnCours: Promise<void> | null = null;
const abonnes = new Set<() => void>();
type SurEnvoi = (evaluationId: string, resultat: { syncVersion: number; reponses: Reponse[] }) => void;
let surReponseEnvoyee: SurEnvoi = () => {};

// ─── État et abonnements (pour l'interface) ───

let instantane: Element[] = [];
const notifier = () => { instantane = [...index.elements]; abonnes.forEach((a) => a()); };
export const abonner = (rappel: () => void) => { abonnes.add(rappel); return () => { abonnes.delete(rappel); }; };
export const elements = () => instantane;
export const definirSurReponseEnvoyee = (rappel: SurEnvoi) => { surReponseEnvoyee = rappel; };

const sauvegarder = async () => { await coffre.ecrireJson(FICHIER_INDEX, index); notifier(); };

export const charger = () => {
  if (!chargement) {
    chargement = coffre.lireJson<Index>(FICHIER_INDEX)
      .then((lu) => { if (lu) index = lu; notifier(); })
      .catch(() => { notifier(); }); // coffre illisible (clé changée) : on repart d'une file vide
  }
  return chargement;
};

/** Remplace les identifiants de photos locales déjà envoyées par leur identifiant serveur. */
export const resoudre = (fichiers: string[] = []) => fichiers.map((f) => index.correspondances[f] || f);

// ─── Ajouts ───

/** Met une réponse en file (elle remplace une réponse encore en attente pour le même critère). */
export const ajouterReponse = async (evaluationId: string, reponse: Reponse) => {
  await charger();
  index.elements = index.elements.filter((e) => !(e.type === 'reponse' && e.evaluationId === evaluationId && e.critereCode === reponse.critereCode));
  index.elements.push({
    id: Crypto.randomUUID(), type: 'reponse', evaluationId, critereCode: reponse.critereCode, statut: 'attente',
    creeLe: new Date().toISOString(), reponse: { ...reponse, fichiers: resoudre(reponse.fichiers), saisiLe: new Date().toISOString() },
  });
  await sauvegarder();
  envoyer();
};

/** Met une photo en file : copie chiffrée dans le coffre. Renvoie son identifiant local (« local:… »). */
export const ajouterPhoto = async ({ evaluationId, critereCode, uri, gps }: {
  evaluationId: string; critereCode: string; uri: string; gps?: ElementPhoto['gps'];
}) => {
  await charger();
  const id = Crypto.randomUUID();
  await coffre.ecrire(nomPhoto(id), await new File(uri).bytes());
  index.elements.push({
    id, type: 'photo', evaluationId, critereCode, statut: 'attente', clientId: Crypto.randomUUID(),
    creeLe: new Date().toISOString(), prisLe: new Date().toISOString(), gps,
  });
  await sauvegarder();
  envoyer();
  return `${PREFIXE_LOCAL}${id}`;
};

/** Retire une photo pas encore envoyée (supprimée par l'évaluateur). */
export const retirerPhotoLocale = async (idLocal: string) => {
  const id = idLocal.replace(PREFIXE_LOCAL, '');
  index.elements = index.elements.filter((e) => e.id !== id);
  coffre.supprimer(nomPhoto(id));
  await sauvegarder();
};

// ─── Envoi ───

const estRefus = (err: unknown) => err instanceof ErreurApi && err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 429;

const envoyerPhoto = async (e: ElementPhoto) => {
  const octets = await coffre.lire(nomPhoto(e.id));
  if (!octets) throw new ErreurApi(410, 'Photo introuvable dans le coffre');
  // Copie déchiffrée temporaire, le temps de l'envoi, puis supprimée
  const temporaire = new File(Paths.cache, `envoi-${e.id}.jpg`);
  if (!temporaire.exists) temporaire.create();
  temporaire.write(octets);
  try {
    const formulaire = new FormData();
    formulaire.append('evaluation', e.evaluationId);
    formulaire.append('critereCode', e.critereCode);
    formulaire.append('clientId', e.clientId);
    formulaire.append('prisLe', e.prisLe);
    if (e.gps) {
      formulaire.append('longitude', String(e.gps.longitude));
      formulaire.append('latitude', String(e.gps.latitude));
      if (e.gps.precision) formulaire.append('precision', String(e.gps.precision));
    }
    formulaire.append('fichier', { uri: temporaire.uri, name: `${e.critereCode}.jpg`, type: 'image/jpeg' } as unknown as Blob);
    const { data } = await api.envoyer<{ _id: string }>('/fichiers', formulaire);
    index.correspondances[`${PREFIXE_LOCAL}${e.id}`] = data._id;
    index.elements.forEach((x) => { if (x.type === 'reponse') x.reponse.fichiers = resoudre(x.reponse.fichiers); });
    coffre.supprimer(nomPhoto(e.id));
  } finally {
    if (temporaire.exists) temporaire.delete();
  }
};

const envoyerReponse = async (e: ElementReponse) => {
  const { data } = await api.patch<{ syncVersion: number; reponses: Reponse[] }>(`/evaluations/${e.evaluationId}/reponses`, { reponses: [e.reponse] });
  surReponseEnvoyee(e.evaluationId, data);
};

/**
 * Envoie tout ce qui peut l'être, dans l'ordre (photos d'abord). S'arrête à la première coupure ;
 * un refus du serveur bloque seulement l'élément concerné.
 */
export const envoyer = () => {
  if (!envoiEnCours) {
    envoiEnCours = (async () => {
      await charger();
      const aTraiter = () => [
        ...index.elements.filter((e): e is ElementPhoto => e.type === 'photo' && e.statut === 'attente'),
        ...index.elements.filter((e): e is ElementReponse => e.type === 'reponse' && e.statut === 'attente'
          && !(e.reponse.fichiers || []).some((f) => f.startsWith(PREFIXE_LOCAL))), // photos pas encore parties
      ];
      // Passages successifs tant que quelque chose part : une réponse qui attendait ses photos
      // devient envoyable dès qu'elles sont parties.
      // Un élément en échec n'est retenté qu'au prochain envoi (pas en boucle dans la même tournée).
      const echoues = new Set<string>();
      for (let progression = true; progression;) {
        progression = false;
        for (const e of aTraiter().filter((x) => !echoues.has(x.id))) {
          try {
            if (e.type === 'photo') await envoyerPhoto(e); else await envoyerReponse(e);
            index.elements = index.elements.filter((x) => x.id !== e.id);
            await sauvegarder();
            progression = true;
          } catch (err) {
            e.erreur = messageErreur(err);
            if (estRefus(err)) e.statut = 'bloque';
            else echoues.add(e.id);
            await sauvegarder();
            if (err instanceof ErreurReseau) return; // serveur injoignable : inutile d'essayer la suite
          }
        }
      }
    })().finally(() => { envoiEnCours = null; });
  }
  return envoiEnCours;
};

/** Remet en attente les éléments bloqués (après correction côté serveur, par exemple). */
export const reessayerBloques = async () => {
  index.elements.forEach((e) => { e.statut = 'attente'; delete e.erreur; });
  await sauvegarder();
  return envoyer();
};

/** Efface la file et le coffre (déconnexion). */
export const vider = async () => {
  index = { elements: [], correspondances: {} };
  chargement = Promise.resolve();
  await coffre.toutEffacer();
  notifier();
};
