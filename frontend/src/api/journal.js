import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, versQuery } from './client';

/** Journal d'activité paginé. params : page, limite, utilisateur, action, entite, du, au. */
export const useJournal = (params) => useQuery({
  queryKey: ['journal', params],
  queryFn: () => api.get(`/journal${versQuery(params)}`),
  placeholderData: keepPreviousData,
});
