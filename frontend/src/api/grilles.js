import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, versQuery } from './client';

/** Liste résumée des grilles (toutes versions). params : statut, niveau, code. */
export const useGrilles = (params = {}) => useQuery({
  queryKey: ['grilles', params],
  queryFn: async () => (await api.get(`/grilles${versQuery(params)}`)).data,
});

export const useGrille = (id) => useQuery({
  queryKey: ['grille', id],
  queryFn: async () => (await api.get(`/grilles/${id}`)).data,
  enabled: Boolean(id),
});

const useInvalider = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['grilles'] });
    queryClient.invalidateQueries({ queryKey: ['grille'] });
  };
};

const mutation = (fn) => () => {
  const invalider = useInvalider();
  return useMutation({ mutationFn: fn, onSuccess: invalider });
};

export const useCreerGrille = mutation(async (donnees) => (await api.post('/grilles', donnees)).data);
export const useEnregistrerGrille = mutation(async ({ id, ...donnees }) => (await api.put(`/grilles/${id}`, donnees)).data);
export const usePublierGrille = mutation((id) => api.post(`/grilles/${id}/publier`));
export const useNouvelleVersion = mutation(async (id) => (await api.post(`/grilles/${id}/nouvelle-version`)).data);
export const useArchiverGrille = mutation((id) => api.post(`/grilles/${id}/archiver`));
export const useSupprimerGrille = mutation((id) => api.delete(`/grilles/${id}`));

export const useImporterGrille = () => {
  const invalider = useInvalider();
  return useMutation({
    mutationFn: async ({ fichier, simulation }) => (
      await api.envoyerFichier(`/grilles/import?simulation=${simulation}`, { fichier })
    ).data,
    onSuccess: (rapport) => { if (rapport.enregistree) invalider(); },
  });
};

/** Contrôles avant publication : { erreurs, avertissements }. */
export const verifierGrille = async (id) => (await api.get(`/grilles/${id}/verification`)).data;

/** Score qu'obtiendraient ces réponses avec la grille enregistrée. */
export const simulerScore = async (id, reponses) => (await api.post(`/grilles/${id}/simuler-score`, { reponses })).data;

export const exporterGrille = (id, format) => api.telecharger(`/grilles/${id}/export?format=${format}`);
