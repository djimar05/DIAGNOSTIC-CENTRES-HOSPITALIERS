import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Evaluation, Gps, Grille, MesMissions, Verification } from './types';

/**
 * Collecte en ligne : missions et grilles téléchargées en un appel, puis saisie de l'évaluation
 * (chaque réponse est enregistrée sur le serveur dès qu'elle est donnée).
 */

export const useMesMissions = () => useQuery({
  queryKey: ['mes-missions'],
  queryFn: async () => (await api.get<MesMissions>('/mobile/mes-missions')).data,
});

/** Mission (et sa grille) depuis le téléchargement « mes missions ». */
export const useMissionMobile = (missionId?: string) => {
  const requete = useMesMissions();
  const mission = requete.data?.missions.find((m) => m._id === missionId);
  return { ...requete, mission };
};

/** Mission retrouvée à partir de l'identifiant de son évaluation. */
export const useMissionDeLEvaluation = (evaluationId?: string) => {
  const requete = useMesMissions();
  const mission = requete.data?.missions.find((m) => m.evaluation?._id === evaluationId);
  return { ...requete, mission };
};

/** Grille d'une évaluation : déjà dans « mes missions », sinon téléchargée (elle est figée : cache permanent). */
export const useGrille = (grilleId?: string) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['grille', grilleId],
    queryFn: async () => {
      const deja = queryClient.getQueryData<MesMissions>(['mes-missions'])?.grilles.find((g) => g._id === grilleId);
      return deja || (await api.get<Grille>(`/mobile/grilles/${grilleId}`)).data;
    },
    enabled: Boolean(grilleId),
    staleTime: Infinity,
  });
};

export const useEvaluation = (id?: string) => useQuery({
  queryKey: ['evaluation', id],
  queryFn: async () => (await api.get<Evaluation>(`/evaluations/${id}`)).data,
  enabled: Boolean(id),
});

export const useVerification = (id?: string) => useQuery({
  queryKey: ['verification', id],
  queryFn: async () => (await api.get<Verification>(`/evaluations/${id}/verification`)).data,
  enabled: Boolean(id),
  staleTime: 0,
});

export const useDemarrer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, gps }: { id: string; gps?: Gps }) => (await api.post<Evaluation>(`/evaluations/${id}/demarrer`, { gps, debut: new Date().toISOString() })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mes-missions'] }),
  });
};

// Les réponses et les photos passent par la file d'attente locale chiffrée (src/hors-ligne/fileAttente.ts).

export const enregistrerObservationsGenerales = (evaluationId: string, observationsGenerales: string) => (
  api.patch(`/evaluations/${evaluationId}/reponses`, { reponses: [], observationsGenerales })
);

export const supprimerFichier = (id: string) => api.delete(`/fichiers/${id}`);

export const useSoumettre = (evaluationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<Evaluation>(`/evaluations/${evaluationId}/soumettre`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mes-missions'] });
      queryClient.invalidateQueries({ queryKey: ['evaluation', evaluationId] });
    },
  });
};
