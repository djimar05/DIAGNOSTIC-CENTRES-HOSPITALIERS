import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, versQuery } from './client';

// ─── Lecture ───

/** Campagnes visibles, avec avancement résumé. params : statut, recherche. */
export const useCampagnes = (params = {}) => useQuery({
  queryKey: ['campagnes', params],
  queryFn: async () => (await api.get(`/campagnes${versQuery(params)}`)).data,
});

export const useCampagne = (id) => useQuery({
  queryKey: ['campagne', id],
  queryFn: async () => (await api.get(`/campagnes/${id}`)).data,
  enabled: Boolean(id),
});

export const useAvancement = (id) => useQuery({
  queryKey: ['campagne', id, 'avancement'],
  queryFn: async () => (await api.get(`/campagnes/${id}/avancement`)).data,
  enabled: Boolean(id),
});

/** Évaluateurs et superviseurs possibles : pour une campagne existante, ou pour une zone (assistant). */
export const useIntervenants = ({ campagne, zone }, { enabled = true } = {}) => useQuery({
  queryKey: ['intervenants', campagne || `zone-${zone || 'nationale'}`],
  queryFn: async () => (await api.get(campagne ? `/campagnes/${campagne}/intervenants` : `/campagnes/intervenants${versQuery({ zone })}`)).data,
  enabled,
  staleTime: 60 * 1000,
});

/** Missions visibles. params : campagne, statut, du, au, sansEquipe, sansDate, enRetard. */
export const useMissions = (params, { enabled = true } = {}) => useQuery({
  queryKey: ['missions', params],
  queryFn: async () => (await api.get(`/missions${versQuery(params)}`)).data,
  placeholderData: keepPreviousData,
  enabled,
});

// ─── Écriture ───

const useInvalider = () => {
  const queryClient = useQueryClient();
  return () => {
    ['campagnes', 'campagne', 'missions'].forEach((cle) => queryClient.invalidateQueries({ queryKey: [cle] }));
  };
};

const mutation = (fn) => () => {
  const invalider = useInvalider();
  return useMutation({ mutationFn: fn, onSuccess: invalider });
};

export const useCreerCampagne = mutation(async (donnees) => (await api.post('/campagnes', donnees)).data);
export const useModifierCampagne = mutation(async ({ id, ...donnees }) => (await api.patch(`/campagnes/${id}`, donnees)).data);
export const useDemarrerCampagne = mutation(async (id) => (await api.post(`/campagnes/${id}/demarrer`)).data);
export const useCloturerCampagne = mutation(({ id, forcer }) => api.post(`/campagnes/${id}/cloturer`, { forcer }));
export const useAjouterMissions = mutation(async ({ id, ...donnees }) => (await api.post(`/campagnes/${id}/missions`, donnees)).data);
export const useAffecterEquipe = mutation(async ({ id, ...donnees }) => (await api.post(`/campagnes/${id}/equipe`, donnees)).data);
export const useModifierMission = mutation(async ({ id, ...donnees }) => (await api.patch(`/missions/${id}`, donnees)).data);
export const useSupprimerMission = mutation((id) => api.delete(`/missions/${id}`));
