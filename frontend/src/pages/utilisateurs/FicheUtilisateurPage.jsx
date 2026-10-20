import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ActionIcon, Anchor, Avatar, Badge, Breadcrumbs, Button, Card, Center, Group, Loader, Menu, SimpleGrid,
  Stack, Table, Text, Title, Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconDots, IconEdit, IconHistory, IconKey, IconPlus, IconTrash, IconUserCheck, IconUserOff, IconX,
} from '@tabler/icons-react';
import {
  useAffectations, useModifierUtilisateur, useRetirerAffectation, useSupprimerUtilisateur, useUtilisateur,
} from '../../api/utilisateurs';
import { useAuth } from '../../auth/AuthProvider';
import { BadgeRole } from '../../composants/BadgesRoles';
import { LIBELLES_LANGUES, libellePerimetre, libelleRole } from '../../constantes/roles';
import { messageErreur, notifierErreur, notifierSucces } from '../../utils/erreurs';
import { formatDate, formatDateHeure, initiales, nomComplet } from '../../utils/format';
import ModaleAffectation from './ModaleAffectation';
import ModaleMotDePasse from './ModaleMotDePasse';
import ModaleUtilisateur from './ModaleUtilisateur';

/** État d'une affectation à la date du jour. */
const etatAffectation = (a) => {
  const maintenant = new Date();
  if (!a.actif) return { libelle: 'Retirée', couleur: 'gray', active: false };
  if (new Date(a.dateDebut) > maintenant) return { libelle: 'À venir', couleur: 'blue', active: true };
  if (a.dateFin && new Date(a.dateFin) <= maintenant) return { libelle: 'Expirée', couleur: 'gray', active: false };
  return { libelle: 'Active', couleur: 'teal', active: true };
};

function Info({ libelle, children }) {
  return (
    <div>
      <Text size="xs" c="dimmed">{libelle}</Text>
      <Text size="sm">{children || '—'}</Text>
    </div>
  );
}

/** W3 – Fiche d'un utilisateur et ses affectations (rôle + périmètre). */
export default function FicheUtilisateurPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { utilisateur: moi, aLeRole } = useAuth();
  const estAdmin = aLeRole('ADMINISTRATEUR');
  const soiMeme = moi._id === id;

  const { data: utilisateur, isPending, error } = useUtilisateur(id);
  const { data: affectations = [], isPending: chargementAffectations } = useAffectations(id);
  const modifier = useModifierUtilisateur(id);
  const supprimer = useSupprimerUtilisateur();
  const retirer = useRetirerAffectation(id);

  const [modale, setModale] = useState(null); // 'modifier' | 'motDePasse' | 'affectation'
  const fermer = () => setModale(null);

  if (isPending) return <Center p="xl"><Loader /></Center>;
  if (error) return <Text c="red">{messageErreur(error)}</Text>;

  const nom = nomComplet(utilisateur);

  const basculerActif = () => modals.openConfirmModal({
    title: utilisateur.actif ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?',
    children: (
      <Text size="sm">
        {utilisateur.actif
          ? `${nom} ne pourra plus se connecter et ses sessions en cours seront fermées. Son historique est conservé.`
          : `${nom} pourra de nouveau se connecter.`}
      </Text>
    ),
    labels: { confirm: utilisateur.actif ? 'Désactiver' : 'Réactiver', cancel: 'Annuler' },
    confirmProps: { color: utilisateur.actif ? 'red' : 'teal' },
    onConfirm: () => modifier.mutate({ actif: !utilisateur.actif }, {
      onSuccess: () => notifierSucces(utilisateur.actif ? 'Compte désactivé' : 'Compte réactivé'),
      onError: (err) => notifierErreur(err),
    }),
  });

  const confirmerSuppression = () => modals.openConfirmModal({
    title: 'Supprimer définitivement ce compte ?',
    children: (
      <Text size="sm">
        Le compte de {nom} sera supprimé et ses affectations retirées. Cette action est irréversible :
        préférez la désactivation pour garder l'historique.
      </Text>
    ),
    labels: { confirm: 'Supprimer', cancel: 'Annuler' },
    confirmProps: { color: 'red' },
    onConfirm: () => supprimer.mutate(id, {
      onSuccess: () => { notifierSucces('Compte supprimé'); navigate('/utilisateurs', { replace: true }); },
      onError: (err) => notifierErreur(err),
    }),
  });

  const confirmerRetrait = (a) => modals.openConfirmModal({
    title: 'Retirer cette affectation ?',
    children: (
      <Text size="sm">
        {nom} perdra le rôle « {libelleRole(a.role)} » sur le périmètre « {libellePerimetre(a)} ».
        L'affectation reste visible dans l'historique.
      </Text>
    ),
    labels: { confirm: 'Retirer', cancel: 'Annuler' },
    confirmProps: { color: 'red' },
    onConfirm: () => retirer.mutate(a._id, {
      onSuccess: () => notifierSucces('Affectation retirée'),
      onError: (err) => notifierErreur(err),
    }),
  });

  return (
    <Stack maw={1100}>
      <Breadcrumbs>
        <Anchor component={Link} to="/utilisateurs" size="sm">Utilisateurs</Anchor>
        <Text size="sm">{nom}</Text>
      </Breadcrumbs>

      <Group justify="space-between" align="flex-start">
        <Group wrap="nowrap">
          <Avatar size="lg" radius="xl" color="brand">{initiales(utilisateur)}</Avatar>
          <div>
            <Title order={2}>{nom}</Title>
            <Group gap={6} mt={4}>
              {utilisateur.actif
                ? <Badge color="teal" variant="dot">Actif</Badge>
                : <Badge color="gray" variant="dot">Désactivé</Badge>}
              {utilisateur.motDePasseAChanger && <Badge color="orange" variant="light">Mot de passe temporaire</Badge>}
            </Group>
          </div>
        </Group>

        {estAdmin && (
          <Group gap="xs">
            <Button variant="default" leftSection={<IconEdit size={16} />} onClick={() => setModale('modifier')}>Modifier</Button>
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="default" size="lg" aria-label="Autres actions"><IconDots size={18} /></ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconKey size={16} />} onClick={() => setModale('motDePasse')}>Réinitialiser le mot de passe</Menu.Item>
                <Menu.Item leftSection={<IconHistory size={16} />} component={Link} to={`/journal?utilisateur=${id}`}>Voir son activité</Menu.Item>
                {!soiMeme && (
                  <>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={utilisateur.actif ? <IconUserOff size={16} /> : <IconUserCheck size={16} />}
                      color={utilisateur.actif ? 'orange' : 'teal'}
                      onClick={basculerActif}
                    >
                      {utilisateur.actif ? 'Désactiver le compte' : 'Réactiver le compte'}
                    </Menu.Item>
                    <Menu.Item leftSection={<IconTrash size={16} />} color="red" onClick={confirmerSuppression}>Supprimer</Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        )}
      </Group>

      <Card withBorder>
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
          <Info libelle="Téléphone">{utilisateur.telephone}</Info>
          <Info libelle="E-mail">{utilisateur.email}</Info>
          <Info libelle="Fonction">{utilisateur.fonction}</Info>
          <Info libelle="Langue">{LIBELLES_LANGUES[utilisateur.langue]}</Info>
          <Info libelle="Dernière connexion">{formatDateHeure(utilisateur.derniereConnexion)}</Info>
          <Info libelle="Compte créé le">{formatDate(utilisateur.createdAt)}</Info>
        </SimpleGrid>
      </Card>

      <Card withBorder p={0}>
        <Group justify="space-between" p="md">
          <div>
            <Title order={4}>Affectations</Title>
            {!estAdmin && <Text size="xs" c="dimmed">Seules les affectations de votre périmètre sont affichées.</Text>}
          </div>
          <Button size="sm" leftSection={<IconPlus size={16} />} onClick={() => setModale('affectation')} disabled={!utilisateur.actif}>
            Ajouter
          </Button>
        </Group>
        {chargementAffectations ? (
          <Center p="md"><Loader size="sm" /></Center>
        ) : affectations.length === 0 ? (
          <Text c="dimmed" size="sm" px="md" pb="md">Aucune affectation : ce compte n'a accès à aucun module.</Text>
        ) : (
          <Table.ScrollContainer minWidth={640}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Rôle</Table.Th>
                  <Table.Th>Périmètre</Table.Th>
                  <Table.Th>Début</Table.Th>
                  <Table.Th>Fin</Table.Th>
                  <Table.Th>État</Table.Th>
                  <Table.Th aria-label="Actions" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {affectations.map((a) => {
                  const etat = etatAffectation(a);
                  return (
                    <Table.Tr key={a._id} style={{ opacity: etat.active ? 1 : 0.6 }}>
                      <Table.Td><BadgeRole role={a.role} /></Table.Td>
                      <Table.Td><Text size="sm">{libellePerimetre(a)}</Text></Table.Td>
                      <Table.Td><Text size="sm">{formatDate(a.dateDebut)}</Text></Table.Td>
                      <Table.Td><Text size="sm">{formatDate(a.dateFin)}</Text></Table.Td>
                      <Table.Td><Badge color={etat.couleur} variant="light">{etat.libelle}</Badge></Table.Td>
                      <Table.Td>
                        {etat.active && (
                          <Tooltip label="Retirer l'affectation">
                            <ActionIcon variant="subtle" color="red" onClick={() => confirmerRetrait(a)} aria-label="Retirer">
                              <IconX size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      {estAdmin && (
        <>
          <ModaleUtilisateur ouvert={modale === 'modifier'} onFermer={fermer} utilisateur={utilisateur} />
          <ModaleMotDePasse ouvert={modale === 'motDePasse'} onFermer={fermer} utilisateur={utilisateur} />
        </>
      )}
      <ModaleAffectation ouvert={modale === 'affectation'} onFermer={fermer} utilisateurId={id} />
    </Stack>
  );
}
