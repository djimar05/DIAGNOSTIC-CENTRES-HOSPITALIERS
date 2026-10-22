import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { Mission } from './types';

/** Missions de l'utilisateur connecté (le serveur ne renvoie que les siennes, campagnes démarrées). */
export const useMesMissions = () => useQuery({
  queryKey: ['missions'],
  queryFn: async () => (await api.get<Mission[]>('/missions?limite=500')).data,
});

export const useMission = (id: string) => useQuery({
  queryKey: ['mission', id],
  queryFn: async () => (await api.get<Mission>(`/missions/${id}`)).data,
  enabled: Boolean(id),
});
