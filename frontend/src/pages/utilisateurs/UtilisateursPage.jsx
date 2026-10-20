import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Badge, Button, Card, Center, Group, Loader, Pagination, Select, Stack, Table, Text, TextInput,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconSearch, IconUserPlus } from '@tabler/icons-react';
import { useUtilisateurs } from '../../api/utilisateurs';
import { useAuth } from '../../auth/AuthProvider';
import BadgesRoles from '../../composants/BadgesRoles';
import EnTetePage from '../../composants/EnTetePage';
import { LIBELLES_ROLES } from '../../constantes/roles';
import { messageErreur } from '../../utils/erreurs';
import { nomComplet } from '../../utils/format';
import ModaleUtilisateur from './ModaleUtilisateur';

const LIMITE = 20;
const OPTIONS_ROLES = Object.entries(LIBELLES_ROLES).map(([value, label]) => ({ value, label }));
const OPTIONS_ETAT = [{ value: 'true', label: 'Actifs' }, { value: 'false', label: 'Désactivés' }];

/** W3 – Liste des utilisateurs. Les filtres sont dans l'URL (partageables, conservés au retour). */
export default function UtilisateursPage() {
  const { aLeRole } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [creation, setCreation] = useState(false);
  const [saisie, setSaisie] = useState(params.get('recherche') || '');

  const filtres = {
    page: Number(params.get('page')) || 1,
    limite: LIMITE,
    recherche: params.get('recherche') || '',
    role: params.get('role') || '',
    actif: params.get('actif') || '',
  };
  const { data, isPending, isFetching, error } = useUtilisateurs(filtres);

  const changerFiltre = (cle, valeur) => {
    setParams((p) => {
      const suivant = new URLSearchParams(p);
      if (valeur) suivant.set(cle, valeur); else suivant.delete(cle);
      suivant.delete('page'); // nouveau filtre → retour à la première page
      return suivant;
    }, { replace: true });
  };
  const rechercher = useDebouncedCallback((valeur) => changerFiltre('recherche', valeur.trim()), 400);

  const utilisateurs = data?.data || [];
  const pagination = data?.pagination;

  return (
    <Stack maw={1200}>
      <EnTetePage titre="Utilisateurs" sousTitre={pagination && `${pagination.total} compte(s)`}>
        {aLeRole('ADMINISTRATEUR') && (
          <Button leftSection={<IconUserPlus size={16} />} onClick={() => setCreation(true)}>Nouvel utilisateur</Button>
        )}
      </EnTetePage>

      <Group gap="sm" align="flex-end">
        <TextInput
          placeholder="Nom, téléphone, e-mail…"
          leftSection={<IconSearch size={16} />}
          rightSection={isFetching && !isPending ? <Loader size="xs" /> : null}
          value={saisie}
          onChange={(e) => { setSaisie(e.currentTarget.value); rechercher(e.currentTarget.value); }}
          w={{ base: '100%', sm: 300 }}
          aria-label="Rechercher"
        />
        <Select placeholder="Tous les rôles" data={OPTIONS_ROLES} value={filtres.role || null} onChange={(v) => changerFiltre('role', v)} clearable w={{ base: '100%', sm: 220 }} aria-label="Rôle" />
        <Select placeholder="Tous les états" data={OPTIONS_ETAT} value={filtres.actif || null} onChange={(v) => changerFiltre('actif', v)} clearable w={{ base: '100%', sm: 160 }} aria-label="État" />
      </Group>

      <Card withBorder p={0}>
        {isPending ? (
          <Center p="xl"><Loader /></Center>
        ) : error ? (
          <Text c="red" p="md">{messageErreur(error)}</Text>
        ) : utilisateurs.length === 0 ? (
          <Text c="dimmed" p="md">Aucun utilisateur ne correspond à ces critères.</Text>
        ) : (
          <Table.ScrollContainer minWidth={720}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nom</Table.Th>
                  <Table.Th>Téléphone</Table.Th>
                  <Table.Th>Fonction</Table.Th>
                  <Table.Th>Rôles</Table.Th>
                  <Table.Th>État</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {utilisateurs.map((u) => (
                  <Table.Tr key={u._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/utilisateurs/${u._id}`)}>
                    <Table.Td>
                      <Text size="sm" fw={500}>{nomComplet(u)}</Text>
                      {u.email && <Text size="xs" c="dimmed">{u.email}</Text>}
                    </Table.Td>
                    <Table.Td><Text size="sm">{u.telephone}</Text></Table.Td>
                    <Table.Td><Text size="sm">{u.fonction || '—'}</Text></Table.Td>
                    <Table.Td><BadgesRoles roles={u.roles} /></Table.Td>
                    <Table.Td>
                      {u.actif
                        ? <Badge color="teal" variant="dot">Actif</Badge>
                        : <Badge color="gray" variant="dot">Désactivé</Badge>}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      {pagination?.pages > 1 && (
        <Group justify="center">
          <Pagination
            total={pagination.pages}
            value={filtres.page}
            onChange={(page) => setParams((p) => { const s = new URLSearchParams(p); s.set('page', page); return s; })}
          />
        </Group>
      )}

      <ModaleUtilisateur
        ouvert={creation}
        onFermer={() => setCreation(false)}
        onCree={(u) => navigate(`/utilisateurs/${u._id}`)}
      />
    </Stack>
  );
}
