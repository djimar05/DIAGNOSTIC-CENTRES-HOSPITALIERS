import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  ActionIcon, Anchor, Badge, Card, Center, Code, Group, Loader, Modal, Pagination, Pill, Select, Stack,
  Table, Text, TextInput, Tooltip,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useJournal } from '../../api/journal';
import { useUtilisateur } from '../../api/utilisateurs';
import EnTetePage from '../../composants/EnTetePage';
import { LIBELLES_ACTIONS, libelleAction } from '../../constantes/roles';
import { messageErreur } from '../../utils/erreurs';
import { formatDateHeure, nomComplet } from '../../utils/format';

const LIMITE = 50;
const OPTIONS_ACTIONS = Object.entries(LIBELLES_ACTIONS).map(([value, label]) => ({ value, label }));

const couleurAction = (action) => {
  if (action.endsWith('SUPPRIME') || action.endsWith('RETIREE')) return 'red';
  if (action.startsWith('MOT_DE_PASSE')) return 'orange';
  if (action === 'CONNEXION') return 'gray';
  return 'brand';
};

/** Lien vers l'objet concerné quand un écran existe pour lui. */
function Entite({ entite }) {
  if (!entite?.modele) return <Text size="sm" c="dimmed">—</Text>;
  if (entite.modele === 'Utilisateur') {
    return <Anchor component={Link} to={`/utilisateurs/${entite.id}`} size="sm">Utilisateur</Anchor>;
  }
  return <Text size="sm">{entite.modele}</Text>;
}

/** Filtre « utilisateur » venu de la fiche (lien « Voir son activité »), affiché avec son nom. */
function FiltreUtilisateur({ id, onRetirer }) {
  const { data } = useUtilisateur(id);
  return (
    <Pill withRemoveButton onRemove={onRetirer} size="lg">
      Utilisateur : {data ? nomComplet(data) : '…'}
    </Pill>
  );
}

/** W16 – Journal d'activité (administrateur). */
export default function JournalPage() {
  const [params, setParams] = useSearchParams();
  const [detail, setDetail] = useState(null);

  const filtres = {
    page: Number(params.get('page')) || 1,
    limite: LIMITE,
    utilisateur: params.get('utilisateur') || '',
    action: params.get('action') || '',
    du: params.get('du') || '',
    // "au" inclut toute la journée choisie
    au: params.get('au') ? `${params.get('au')}T23:59:59.999` : '',
  };
  const { data, isPending, isFetching, error } = useJournal(filtres);

  const changerFiltre = (cle, valeur) => {
    setParams((p) => {
      const suivant = new URLSearchParams(p);
      if (valeur) suivant.set(cle, valeur); else suivant.delete(cle);
      suivant.delete('page');
      return suivant;
    }, { replace: true });
  };

  const entrees = data?.data || [];
  const pagination = data?.pagination;

  return (
    <Stack maw={1200}>
      <EnTetePage titre="Journal d'activité" sousTitre="Actions sensibles : connexions, comptes, droits, mots de passe" />

      <Group gap="sm" align="flex-end">
        <Select
          label="Action"
          placeholder="Toutes les actions"
          data={OPTIONS_ACTIONS}
          value={filtres.action || null}
          onChange={(v) => changerFiltre('action', v)}
          clearable
          w={{ base: '100%', sm: 240 }}
        />
        <TextInput type="date" label="Du" value={params.get('du') || ''} onChange={(e) => changerFiltre('du', e.currentTarget.value)} w={{ base: '48%', sm: 170 }} />
        <TextInput type="date" label="Au" value={params.get('au') || ''} onChange={(e) => changerFiltre('au', e.currentTarget.value)} w={{ base: '48%', sm: 170 }} />
        {isFetching && !isPending && <Loader size="xs" mb={10} />}
      </Group>
      {filtres.utilisateur && (
        <Group><FiltreUtilisateur id={filtres.utilisateur} onRetirer={() => changerFiltre('utilisateur', '')} /></Group>
      )}

      <Card withBorder p={0}>
        {isPending ? (
          <Center p="xl"><Loader /></Center>
        ) : error ? (
          <Text c="red" p="md">{messageErreur(error)}</Text>
        ) : entrees.length === 0 ? (
          <Text c="dimmed" p="md">Aucune entrée pour ces critères.</Text>
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="xs" striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Utilisateur</Table.Th>
                  <Table.Th>Action</Table.Th>
                  <Table.Th>Objet</Table.Th>
                  <Table.Th>Adresse IP</Table.Th>
                  <Table.Th aria-label="Détails" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {entrees.map((e) => (
                  <Table.Tr key={e._id}>
                    <Table.Td><Text size="sm" style={{ whiteSpace: 'nowrap' }}>{formatDateHeure(e.createdAt)}</Text></Table.Td>
                    <Table.Td>
                      {e.utilisateur ? (
                        <Anchor component="button" type="button" size="sm" onClick={() => changerFiltre('utilisateur', e.utilisateur._id)}>
                          {nomComplet(e.utilisateur)}
                        </Anchor>
                      ) : <Text size="sm" c="dimmed">Compte supprimé</Text>}
                    </Table.Td>
                    <Table.Td><Badge variant="light" color={couleurAction(e.action)}>{libelleAction(e.action)}</Badge></Table.Td>
                    <Table.Td><Entite entite={e.entite} /></Table.Td>
                    <Table.Td><Text size="xs" c="dimmed" ff="monospace">{e.ip || '—'}</Text></Table.Td>
                    <Table.Td>
                      <Tooltip label="Détails">
                        <ActionIcon variant="subtle" onClick={() => setDetail(e)} aria-label="Détails"><IconInfoCircle size={16} /></ActionIcon>
                      </Tooltip>
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

      <Modal opened={Boolean(detail)} onClose={() => setDetail(null)} title={detail && libelleAction(detail.action)} size="lg">
        {detail && (
          <Stack gap="xs">
            <Text size="sm"><b>Date :</b> {formatDateHeure(detail.createdAt)}</Text>
            <Text size="sm"><b>Par :</b> {detail.utilisateur ? `${nomComplet(detail.utilisateur)} (${detail.utilisateur.telephone})` : '—'}</Text>
            <Text size="sm"><b>Appareil :</b> {detail.appareil || '—'}</Text>
            {detail.details && <Code block>{JSON.stringify(detail.details, null, 2)}</Code>}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
