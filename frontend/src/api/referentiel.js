import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, versQuery } from './client';

// ─── Zones ───

/** Zones du périmètre (liste plate), triées du plus large au plus fin. Le découpage change rarement : cache long. */
export const useZones = () => useQuery({
  queryKey: ['zones'],
  queryFn: async () => (await api.get('/zones')).data,
  staleTime: 10 * 60 * 1000,
});

/** Arbre des zones du périmètre, avec le nombre de centres par zone. */
export const useArbreZones = () => useQuery({
  queryKey: ['zones', 'arbre'],
  queryFn: async () => (await api.get('/zones/arbre')).data,
});

const useInvaliderZones = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['zones'] });
    queryClient.invalidateQueries({ queryKey: ['centres'] }); // un déplacement change le périmètre des centres
  };
};

export const useCreerZone = () => {
  const invalider = useInvaliderZones();
  return useMutation({
    mutationFn: async (donnees) => (await api.post('/zones', donnees)).data,
    onSuccess: invalider,
  });
};

export const useModifierZone = () => {
  const invalider = useInvaliderZones();
  return useMutation({
    mutationFn: async ({ id, ...donnees }) => (await api.patch(`/zones/${id}`, donnees)).data,
    onSuccess: invalider,
  });
};

// ─── Centres ───

/** Centres du périmètre. params : recherche, zone, niveau, statutJuridique, actif, page, limite. */
export const useCentres = (params, { enabled = true } = {}) => useQuery({
  queryKey: ['centres', params],
  queryFn: () => api.get(`/centres${versQuery(params)}`),
  placeholderData: keepPreviousData,
  enabled,
});

export const useCentre = (id) => useQuery({
  queryKey: ['centre', id],
  queryFn: async () => (await api.get(`/centres/${id}`)).data,
  enabled: Boolean(id),
});

export const useEvaluationsCentre = (id, { enabled = true } = {}) => useQuery({
  queryKey: ['centre', id, 'evaluations'],
  queryFn: async () => (await api.get(`/centres/${id}/evaluations`)).data,
  enabled: Boolean(id) && enabled,
});

export const useActionsCentre = (id, { enabled = true } = {}) => useQuery({
  queryKey: ['centre', id, 'actions'],
  queryFn: async () => (await api.get(`/centres/${id}/actions`)).data,
  enabled: Boolean(id) && enabled,
});

const useInvaliderCentres = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['centres'] });
    queryClient.invalidateQueries({ queryKey: ['centre'] });
    queryClient.invalidateQueries({ queryKey: ['zones', 'arbre'] }); // nombre de centres par zone
  };
};

export const useCreerCentre = () => {
  const invalider = useInvaliderCentres();
  return useMutation({
    mutationFn: async (donnees) => (await api.post('/centres', donnees)).data,
    onSuccess: invalider,
  });
};

export const useModifierCentre = (id) => {
  const invalider = useInvaliderCentres();
  return useMutation({
    mutationFn: async (donnees) => (await api.patch(`/centres/${id}`, donnees)).data,
    onSuccess: invalider,
  });
};

/** Import Excel : simulation (rien n'est enregistré) ou import réel. Renvoie le rapport par ligne. */
export const useImporterCentres = () => {
  const invalider = useInvaliderCentres();
  return useMutation({
    mutationFn: async ({ fichier, simulation }) => (
      await api.envoyerFichier(`/centres/import?simulation=${simulation}`, { fichier })
    ).data,
    onSuccess: (rapport) => { if (!rapport.simulation) invalider(); },
  });
};

export const telechargerModeleImport = () => api.telecharger('/centres/import/modele');
