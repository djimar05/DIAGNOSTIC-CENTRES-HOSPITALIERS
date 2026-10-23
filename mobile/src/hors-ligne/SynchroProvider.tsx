import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { Evaluation, Reponse } from '@/api/types';
import * as file from './fileAttente';

const INTERVALLE_MS = 20 * 1000;

/**
 * Relance l'envoi de la file d'attente : au démarrage, au retour au premier plan, et toutes les 20 s
 * tant qu'il reste quelque chose à envoyer. Met à jour le cache des évaluations avec la réponse du serveur.
 */
export function SynchroProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const elements = useFileAttente();
  const enAttente = elements.some((e) => e.statut === 'attente');

  useEffect(() => {
    file.definirSurReponseEnvoyee((evaluationId, resultat) => {
      queryClient.setQueryData<Evaluation>(['evaluation', evaluationId], (avant) => (avant ? { ...avant, ...resultat } : avant));
      queryClient.invalidateQueries({ queryKey: ['verification', evaluationId] });
    });
    file.charger().then(() => file.envoyer());
    const abonnement = AppState.addEventListener('change', (statut) => { if (statut === 'active') file.envoyer(); });
    return () => abonnement.remove();
  }, [queryClient]);

  useEffect(() => {
    if (!enAttente) return undefined;
    const minuterie = setInterval(() => file.envoyer(), INTERVALLE_MS);
    return () => clearInterval(minuterie);
  }, [enAttente]);

  // Dès que la file se vide, la liste des missions est rafraîchie (états « à envoyer » → à jour)
  useEffect(() => {
    if (!enAttente) queryClient.invalidateQueries({ queryKey: ['mes-missions'] });
  }, [enAttente, queryClient]);

  return children;
}

/** Contenu de la file (se met à jour à chaque changement). */
export const useFileAttente = () => useSyncExternalStore(file.abonner, file.elements);

/** Éléments en attente d'une évaluation, et réponses locales pas encore reçues par le serveur. */
export const useEnAttente = (evaluationId?: string) => {
  const elements = useFileAttente();
  return useMemo(() => {
    const siens = elements.filter((e) => e.evaluationId === evaluationId);
    const reponses = new Map<string, Reponse>();
    siens.forEach((e) => { if (e.type === 'reponse') reponses.set(e.critereCode, e.reponse); });
    return {
      elements: siens, reponses, total: siens.length,
      bloques: siens.filter((e) => e.statut === 'bloque'),
      enEchec: siens.filter((e) => e.statut === 'attente' && e.erreur), // dernier essai raté, sera retenté
    };
  }, [elements, evaluationId]);
};

/** Réponses du serveur, complétées par les saisies locales pas encore envoyées. */
export const fusionnerReponses = (serveur: Reponse[] = [], locales: Map<string, Reponse>) => {
  const toutes = new Map(serveur.map((r) => [r.critereCode, r]));
  locales.forEach((r, code) => toutes.set(code, r));
  return [...toutes.values()];
};
