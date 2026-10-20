import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, versQuery } from './client';

/** Zones du périmètre, triées du plus large au plus fin. Le découpage change rarement : cache long. */
export const useZones = () => useQuery({
  queryKey: ['zones'],
  queryFn: async () => (await api.get('/zones')).data,
  staleTime: 10 * 60 * 1000,
});

/** Centres du périmètre. params : recherche, zone, niveau, page, limite. */
export const useCentres = (params, { enabled = true } = {}) => useQuery({
  queryKey: ['centres', params],
  queryFn: () => api.get(`/centres${versQuery(params)}`),
  placeholderData: keepPreviousData,
  enabled,
});
