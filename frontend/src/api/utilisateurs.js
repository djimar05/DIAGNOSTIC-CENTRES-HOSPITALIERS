import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, versQuery } from './client';

// ─── Lecture ───

/** Liste paginée : { data, pagination }. params : page, limite, recherche, actif, role. */
export const useUtilisateurs = (params) => useQuery({
  queryKey: ['utilisateurs', params],
  queryFn: () => api.get(`/utilisateurs${versQuery(params)}`),
  placeholderData: keepPreviousData, // pas de clignotement en changeant de page
});

export const useUtilisateur = (id) => useQuery({
  queryKey: ['utilisateur', id],
  queryFn: async () => (await api.get(`/utilisateurs/${id}`)).data,
  enabled: Boolean(id),
});

export const useAffectations = (utilisateurId) => useQuery({
  queryKey: ['affectations', utilisateurId],
  queryFn: async () => (await api.get(`/utilisateurs/${utilisateurId}/affectations`)).data,
  enabled: Boolean(utilisateurId),
});

// ─── Écriture ───

/** Rafraîchit la liste et la fiche d'un utilisateur après une modification. */
const useInvalider = () => {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: ['utilisateurs'] });
    if (id) {
      queryClient.invalidateQueries({ queryKey: ['utilisateur', id] });
      queryClient.invalidateQueries({ queryKey: ['affectations', id] });
    }
  };
};

export const useCreerUtilisateur = () => {
  const invalider = useInvalider();
  return useMutation({
    mutationFn: async (donnees) => (await api.post('/utilisateurs', donnees)).data,
    onSuccess: () => invalider(),
  });
};

export const useModifierUtilisateur = (id) => {
  const invalider = useInvalider();
  return useMutation({
    mutationFn: async (donnees) => (await api.patch(`/utilisateurs/${id}`, donnees)).data,
    onSuccess: () => invalider(id),
  });
};

export const useReinitialiserMotDePasse = (id) => useMutation({
  mutationFn: (nouveauMotDePasse) => api.patch(`/utilisateurs/${id}/mot-de-passe`, { nouveauMotDePasse }),
});

export const useSupprimerUtilisateur = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/utilisateurs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['utilisateurs'] }),
  });
};

export const useCreerAffectation = (utilisateurId) => {
  const invalider = useInvalider();
  return useMutation({
    mutationFn: async (donnees) => (await api.post(`/utilisateurs/${utilisateurId}/affectations`, donnees)).data,
    onSuccess: () => invalider(utilisateurId),
  });
};

export const useRetirerAffectation = (utilisateurId) => {
  const invalider = useInvalider();
  return useMutation({
    mutationFn: (affectationId) => api.delete(`/affectations/${affectationId}`),
    onSuccess: () => invalider(utilisateurId),
  });
};
