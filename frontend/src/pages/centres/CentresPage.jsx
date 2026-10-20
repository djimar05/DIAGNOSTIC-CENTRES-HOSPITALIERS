import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  Badge, Button, Card, Center, Group, Loader, Pagination, Select, Stack, Table, Text, TextInput,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconFileImport, IconPlus, IconSearch } from '@tabler/icons-react';
import { useCentres } from '../../api/referentiel';
import { useAuth } from '../../auth/AuthProvider';
import EnTetePage from '../../composants/EnTetePage';
import SelectZone from '../../composants/SelectZone';
import {
  COULEURS_CLASSES, LIBELLES_NIVEAUX_CENTRE, LIBELLES_STATUTS_JURIDIQUES, options,
} from '../../constantes/referentiel';
import { messageErreur } from '../../utils/erreurs';
import ModaleCentre from './ModaleCentre';

const LIMITE = 25;
const OPTIONS_ETAT = [{ value: 'true', label: 'Actifs' }, { value: 'false', label: 'Inactifs' }];

/** W5 – Liste des centres du périmètre. Les filtres sont dans l'URL. */
export default function CentresPage() {
  const { aLeRole } = useAuth();
  const estAdmin = aLeRole('ADMINISTRATEUR');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [creation, setCreation] = useState(false);
  const [saisie, setSaisie] = useState(params.get('recherche') || '');

  const filtres = {
    page: Number(params.get('page')) || 1,
    limite: LIMITE,
    recherche: params.get('recherche') || '',
    zone: params.get('zone') || '',
    niveau: params.get('niveau') || '',
    statutJuridique: params.get('statutJuridique') || '',
    actif: params.get('actif') || '',
  };
  const { data, isPending, isFetching, error } = useCentres(filtres);

  const changerFiltre = (cle, valeur) => {
    setParams((p) => {
      const suivant = new URLSearchParams(p);
      if (valeur) suivant.set(cle, valeur); else suivant.delete(cle);
      suivant.delete('page');
      return suivant;
    }, { replace: true });
  };
  const rechercher = useDebouncedCallback((v) => changerFiltre('recherche', v.trim()), 400);

  const centres = data?.data || [];
  const pagination = data?.pagination;

  return (
    <Stack maw={1300}>
      <EnTetePage titre="Centres" sousTitre={pagination && `${pagination.total} centre(s)`}>
        {estAdmin && (
          <>
            <Button variant="default" leftSection={<IconFileImport size={16} />} component={Link} to="/centres/import">Importer (Excel)</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setCreation(true)}>Nouveau centre</Button>
          </>
        )}
      </EnTetePage>

      <Group gap="sm" align="flex-end">
        <TextInput
          placeholder="Nom, code, localité…"
          leftSection={<IconSearch size={16} />}
          rightSection={isFetching && !isPending ? <Loader size="xs" /> : null}
          value={saisie}
          onChange={(e) => { setSaisie(e.currentTarget.value); rechercher(e.currentTarget.value); }}
          w={{ base: '100%', sm: 260 }}
          aria-label="Rechercher"
        />
        <SelectZone placeholder="Toutes les zones" value={filtres.zone || null} onChange={(v) => changerFiltre('zone', v)} clearable w={{ base: '100%', sm: 240 }} aria-label="Zone" />
        <Select placeholder="Tous les niveaux" data={options(LIBELLES_NIVEAUX_CENTRE)} value={filtres.niveau || null} onChange={(v) => changerFiltre('niveau', v)} clearable w={{ base: '100%', sm: 190 }} aria-label="Niveau" />
        <Select placeholder="Tous les statuts" data={options(LIBELLES_STATUTS_JURIDIQUES)} value={filtres.statutJuridique || null} onChange={(v) => changerFiltre('statutJuridique', v)} clearable w={{ base: '100%', sm: 170 }} aria-label="Statut juridique" />
        <Select placeholder="Tous les états" data={OPTIONS_ETAT} value={filtres.actif || null} onChange={(v) => changerFiltre('actif', v)} clearable w={{ base: '100%', sm: 140 }} aria-label="État" />
      </Group>

      <Card withBorder p={0}>
        {isPending ? (
          <Center p="xl"><Loader /></Center>
        ) : error ? (
          <Text c="red" p="md">{messageErreur(error)}</Text>
        ) : centres.length === 0 ? (
          <Text c="dimmed" p="md">Aucun centre ne correspond à ces critères.</Text>
        ) : (
          <Table.ScrollContainer minWidth={820}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Centre</Table.Th>
                  <Table.Th>Niveau</Table.Th>
                  <Table.Th>Zone</Table.Th>
                  <Table.Th>Statut</Table.Th>
                  <Table.Th>Dernière évaluation</Table.Th>
                  <Table.Th>État</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {centres.map((c) => (
                  <Table.Tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/centres/${c._id}`)}>
                    <Table.Td>
                      <Text size="sm" fw={500}>{c.nom}</Text>
                      <Text size="xs" c="dimmed" ff="monospace">{c.code}{c.localite ? ` · ${c.localite}` : ''}</Text>
                    </Table.Td>
                    <Table.Td><Text size="sm">{LIBELLES_NIVEAUX_CENTRE[c.niveau]}</Text></Table.Td>
                    <Table.Td><Text size="sm">{c.zone?.nom || '—'}</Text></Table.Td>
                    <Table.Td><Text size="sm">{LIBELLES_STATUTS_JURIDIQUES[c.statutJuridique] || '—'}</Text></Table.Td>
                    <Table.Td>
                      {c.derniereEvaluation?.classe ? (
                        <Group gap={6}>
                          <Badge color={COULEURS_CLASSES[c.derniereEvaluation.classe]}>{c.derniereEvaluation.classe}</Badge>
                          <Text size="sm">{Math.round(c.derniereEvaluation.score)}/100</Text>
                        </Group>
                      ) : <Text size="sm" c="dimmed">Jamais évalué</Text>}
                    </Table.Td>
                    <Table.Td>
                      {c.actif ? <Badge color="teal" variant="dot">Actif</Badge> : <Badge color="gray" variant="dot">Inactif</Badge>}
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

      {estAdmin && (
        <ModaleCentre ouvert={creation} onFermer={() => setCreation(false)} onCree={(c) => navigate(`/centres/${c._id}`)} />
      )}
    </Stack>
  );
}
