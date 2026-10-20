import { useEffect, useMemo, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import {
  Accordion, ActionIcon, Alert, Anchor, Badge, Breadcrumbs, Button, Card, Center, Group, List, Loader, Menu, Modal,
  MultiSelect, NumberInput, SimpleGrid, Stack, Table, Tabs, Text, TextInput, Title, Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconAlertCircle, IconAlertTriangle, IconArchive, IconArrowDown, IconArrowUp, IconCopy, IconDeviceFloppy, IconDownload,
  IconEdit, IconEye, IconLock, IconPlus, IconRocket, IconTrash, IconListDetails,
} from '@tabler/icons-react';
import { enregistrerFichier } from '../../api/client';
import {
  exporterGrille, useArchiverGrille, useEnregistrerGrille, useGrille, useNouvelleVersion, usePublierGrille,
  useSupprimerGrille, verifierGrille,
} from '../../api/grilles';
import {
  LIBELLES_TYPES_REPONSE, STATUTS_GRILLE, classesDepuisSeuils, estNote, seuilsDepuisClasses,
} from '../../constantes/grilles';
import { LIBELLES_NIVEAUX_CENTRE, options } from '../../constantes/referentiel';
import { messageErreur, notifierErreur, notifierSucces } from '../../utils/erreurs';
import { formatDate } from '../../utils/format';
import ApercuGrille from './ApercuGrille';
import ModaleCritere from './ModaleCritere';

/** Copie modifiable de la grille (seuls les champs de contenu). */
const versBrouillon = (g) => ({
  nom: g.nom,
  niveauxCibles: [...g.niveauxCibles],
  seuils: seuilsDepuisClasses(g.classes),
  domaines: structuredClone(g.domaines),
});

/** Contenu envoyé au serveur ; l'ordre affiché devient le champ `ordre`. */
const versEnvoi = (b) => ({
  nom: b.nom,
  niveauxCibles: b.niveauxCibles,
  classes: classesDepuisSeuils(b.seuils),
  domaines: b.domaines.map((d, i) => ({ ...d, ordre: i + 1, criteres: d.criteres.map((c, j) => ({ ...c, ordre: j + 1 })) })),
});

const deplacer = (liste, i, sens) => {
  const copie = [...liste];
  const j = i + sens;
  if (j < 0 || j >= copie.length) return copie;
  [copie[i], copie[j]] = [copie[j], copie[i]];
  return copie;
};

function BadgesCritere({ c }) {
  return (
    <Group gap={4}>
      {!estNote(c) && <Badge size="xs" color="gray" variant="light">non noté</Badge>}
      {c.eliminatoire && <Badge size="xs" color="red" variant="light">éliminatoire</Badge>}
      {c.obligatoire === false && <Badge size="xs" color="gray" variant="outline">facultatif</Badge>}
      {c.sansObjetAutorise && <Badge size="xs" color="gray" variant="outline">sans objet possible</Badge>}
      {c.preuveExigee && c.preuveExigee !== 'AUCUNE' && <Badge size="xs" color="blue" variant="light">{c.preuveExigee.toLowerCase()}</Badge>}
      {c.condition?.critere && <Badge size="xs" color="grape" variant="light">si {c.condition.critere} = {String(c.condition.valeur)}</Badge>}
    </Group>
  );
}

/** W6 – Éditeur d'une grille : paramètres, domaines → critères, aperçu avec score, publication. */
export default function EditeurGrillePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: grille, isPending, error } = useGrille(id);
  const enregistrer = useEnregistrerGrille();
  const publier = usePublierGrille();
  const nouvelleVersion = useNouvelleVersion();
  const archiver = useArchiverGrille();
  const supprimer = useSupprimerGrille();

  const [brouillon, setBrouillon] = useState(null);
  const [ouverts, setOuverts] = useState([]);
  const [edition, setEdition] = useState(null); // { domaine: index, critere: index | null }
  const [verification, setVerification] = useState(null);
  const [onglet, setOnglet] = useState('contenu');

  useEffect(() => { if (grille) setBrouillon(versBrouillon(grille)); }, [grille]);

  const modifie = useMemo(
    () => Boolean(grille && brouillon) && JSON.stringify(versEnvoi(brouillon)) !== JSON.stringify(versEnvoi(versBrouillon(grille))),
    [grille, brouillon],
  );

  // Modifications non enregistrées : confirmation avant de quitter la page
  const blocage = useBlocker(({ currentLocation, nextLocation }) => modifie && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocage.state !== 'blocked') return;
    if (window.confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) blocage.proceed(); else blocage.reset();
  }, [blocage]);
  useEffect(() => {
    if (!modifie) return undefined;
    const avertir = (e) => { e.preventDefault(); };
    window.addEventListener('beforeunload', avertir);
    return () => window.removeEventListener('beforeunload', avertir);
  }, [modifie]);

  if (isPending || (grille && !brouillon)) return <Center p="xl"><Loader /></Center>;
  if (error) return <Text c="red">{messageErreur(error)}</Text>;

  const lectureSeule = grille.statut !== 'BROUILLON';
  const totalPoids = brouillon.domaines.reduce((s, d) => s + (Number(d.poids) || 0), 0);
  const tousCriteres = brouillon.domaines.flatMap((d) => d.criteres);
  const codesDomaines = brouillon.domaines.map((d) => d.code);

  const changer = (modif) => setBrouillon((b) => ({ ...b, ...(typeof modif === 'function' ? modif(b) : modif) }));
  const changerDomaine = (i, modif) => changer((b) => ({ domaines: b.domaines.map((d, k) => (k === i ? { ...d, ...modif } : d)) }));

  const ajouterDomaine = () => {
    const cle = `nouveau-${Date.now()}`;
    changer((b) => ({ domaines: [...b.domaines, { _cle: cle, code: '', nom: 'Nouveau domaine', poids: 0, plafondSiEliminatoire: 40, criteres: [] }] }));
    setOuverts((o) => [...o, cle]);
  };
  const supprimerDomaine = (i) => modals.openConfirmModal({
    title: `Supprimer le domaine « ${brouillon.domaines[i].nom} » ?`,
    children: <Text size="sm">Ses {brouillon.domaines[i].criteres.length} critère(s) seront supprimés.</Text>,
    labels: { confirm: 'Supprimer', cancel: 'Annuler' },
    confirmProps: { color: 'red' },
    onConfirm: () => changer((b) => ({ domaines: b.domaines.filter((_, k) => k !== i) })),
  });

  const validerCritere = (critere) => {
    const { domaine, critere: index } = edition;
    changerDomaine(domaine, {
      criteres: index === null
        ? [...brouillon.domaines[domaine].criteres, critere]
        : brouillon.domaines[domaine].criteres.map((c, k) => (k === index ? critere : c)),
    });
  };
  const supprimerCritere = (i, j) => {
    const code = brouillon.domaines[i].criteres[j].code;
    const dependants = tousCriteres.filter((c) => c.condition?.critere === code).map((c) => c.code);
    if (dependants.length) {
      notifierErreur({ status: 400, message: `${code} conditionne l'affichage de ${dependants.join(', ')} : retirez d'abord ces conditions` });
      return;
    }
    changerDomaine(i, { criteres: brouillon.domaines[i].criteres.filter((_, k) => k !== j) });
  };

  const sauvegarder = async () => {
    try {
      await enregistrer.mutateAsync({ id, ...versEnvoi(brouillon) });
      notifierSucces('Grille enregistrée');
      return true;
    } catch (err) {
      notifierErreur(err, 'Enregistrement impossible');
      return false;
    }
  };

  const preparerPublication = async () => {
    if (modifie && !(await sauvegarder())) return;
    try {
      setVerification(await verifierGrille(id));
    } catch (err) {
      notifierErreur(err);
    }
  };
  const confirmerPublication = async () => {
    try {
      await publier.mutateAsync(id);
      setVerification(null);
      notifierSucces(`Grille publiée (version ${grille.version}). La version précédente éventuelle est archivée.`);
    } catch (err) {
      notifierErreur(err, 'Publication impossible');
    }
  };

  const creerVersion = async () => {
    try {
      const v = await nouvelleVersion.mutateAsync(id);
      notifierSucces(`Version ${v.version} créée en brouillon`);
      navigate(`/grilles/${v._id}`);
    } catch (err) {
      notifierErreur(err);
    }
  };
  const confirmerArchivage = () => modals.openConfirmModal({
    title: 'Archiver cette grille ?',
    children: <Text size="sm">Elle ne pourra plus être choisie pour une nouvelle campagne. Les évaluations existantes restent consultables.</Text>,
    labels: { confirm: 'Archiver', cancel: 'Annuler' },
    onConfirm: () => archiver.mutate(id, { onSuccess: () => notifierSucces('Grille archivée'), onError: (e) => notifierErreur(e) }),
  });
  const confirmerSuppression = () => modals.openConfirmModal({
    title: 'Supprimer ce brouillon ?',
    children: <Text size="sm">Le brouillon version {grille.version} sera définitivement supprimé.</Text>,
    labels: { confirm: 'Supprimer', cancel: 'Annuler' },
    confirmProps: { color: 'red' },
    onConfirm: () => supprimer.mutate(id, {
      onSuccess: () => { notifierSucces('Brouillon supprimé'); setBrouillon(versBrouillon(grille)); navigate('/grilles', { replace: true }); },
      onError: (e) => notifierErreur(e),
    }),
  });
  const telecharger = async (format) => {
    try {
      enregistrerFichier(await exporterGrille(id, format), `grille-${grille.code}-v${grille.version}.${format}`);
    } catch (err) {
      notifierErreur(err, 'Export impossible');
    }
  };

  const statut = STATUTS_GRILLE[grille.statut];
  const critereEdite = edition && edition.critere !== null ? brouillon.domaines[edition.domaine].criteres[edition.critere] : null;

  return (
    <Stack maw={1200}>
      <Breadcrumbs>
        <Anchor component={Link} to="/grilles" size="sm">Grilles</Anchor>
        <Text size="sm">{grille.code} v{grille.version}</Text>
      </Breadcrumbs>

      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>{brouillon.nom || grille.nom}</Title>
          <Group gap={6} mt={4}>
            <Text size="sm" c="dimmed" ff="monospace">{grille.code} · version {grille.version}</Text>
            <Badge color={statut.couleur} variant="light">{statut.libelle}</Badge>
            {grille.publieeLe && <Text size="xs" c="dimmed">publiée le {formatDate(grille.publieeLe)}</Text>}
            {modifie && <Badge color="orange" variant="dot">Modifications non enregistrées</Badge>}
          </Group>
        </div>
        <Group gap="xs">
          {!lectureSeule && (
            <>
              <Button variant="default" leftSection={<IconDeviceFloppy size={16} />} onClick={sauvegarder} disabled={!modifie} loading={enregistrer.isPending}>Enregistrer</Button>
              <Button color="teal" leftSection={<IconRocket size={16} />} onClick={preparerPublication}>Publier…</Button>
            </>
          )}
          {lectureSeule && (
            <Button leftSection={<IconCopy size={16} />} onClick={creerVersion} loading={nouvelleVersion.isPending}>Nouvelle version</Button>
          )}
          <Menu position="bottom-end">
            <Menu.Target><Button variant="default" leftSection={<IconDownload size={16} />}>Exporter</Button></Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => telecharger('xlsx')}>Excel (.xlsx)</Menu.Item>
              <Menu.Item onClick={() => telecharger('json')}>JSON</Menu.Item>
              {grille.statut === 'PUBLIEE' && (<><Menu.Divider /><Menu.Item leftSection={<IconArchive size={16} />} onClick={confirmerArchivage}>Archiver</Menu.Item></>)}
              {grille.statut === 'BROUILLON' && (<><Menu.Divider /><Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={confirmerSuppression}>Supprimer le brouillon</Menu.Item></>)}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      {lectureSeule && (
        <Alert icon={<IconLock />} color="gray">
          Cette grille est {statut.libelle.toLowerCase()} : elle est figée pour que toutes les évaluations faites avec elle restent comparables.
          Pour la modifier, créez une nouvelle version.
        </Alert>
      )}

      <Tabs value={onglet} onChange={setOnglet} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="contenu" leftSection={<IconListDetails size={16} />}>Contenu</Tabs.Tab>
          <Tabs.Tab value="apercu" leftSection={<IconEye size={16} />}>Aperçu et score</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="contenu" pt="md">
          <Stack>
            <Card withBorder>
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <TextInput label="Nom" value={brouillon.nom} onChange={(e) => changer({ nom: e.currentTarget.value })} disabled={lectureSeule} />
                <MultiSelect label="Niveaux de centre ciblés" data={options(LIBELLES_NIVEAUX_CENTRE)} value={brouillon.niveauxCibles} onChange={(v) => changer({ niveauxCibles: v })} disabled={lectureSeule} />
              </SimpleGrid>
              <Text size="sm" fw={500} mt="md">Seuils des classes (score global minimum)</Text>
              <Group gap="sm" mt={4}>
                {['A', 'B', 'C'].map((k) => (
                  <NumberInput key={k} w={110} leftSection={<Text size="sm" fw={700}>{k} ≥</Text>} leftSectionWidth={44} min={0} max={100}
                    value={brouillon.seuils[k]} onChange={(v) => changer((b) => ({ seuils: { ...b.seuils, [k]: Number(v) || 0 } }))} disabled={lectureSeule} />
                ))}
                <Text size="sm" c="dimmed">D en dessous de {brouillon.seuils.C}</Text>
              </Group>
            </Card>

            <Group justify="space-between">
              <Group gap="xs">
                <Title order={4}>Domaines</Title>
                <Badge color={Math.abs(totalPoids - 100) < 0.01 ? 'teal' : 'orange'} variant="light" size="lg">Total des poids : {totalPoids} %</Badge>
              </Group>
              {!lectureSeule && <Button variant="light" leftSection={<IconPlus size={16} />} onClick={ajouterDomaine}>Ajouter un domaine</Button>}
            </Group>

            {brouillon.domaines.length === 0 ? (
              <Card withBorder><Text c="dimmed" size="sm">Aucun domaine. Ajoutez-en un, ou importez la grille officielle depuis la liste des grilles.</Text></Card>
            ) : (
              <Accordion multiple variant="separated" value={ouverts} onChange={setOuverts}>
                {brouillon.domaines.map((d, i) => {
                  const cle = d._id || d._cle;
                  const doublon = d.code && codesDomaines.filter((c) => c === d.code).length > 1;
                  return (
                    <Accordion.Item key={cle} value={cle}>
                      <Accordion.Control>
                        <Group gap="xs" wrap="nowrap">
                          <Text fw={600} size="sm">{i + 1}. {d.nom || '(sans nom)'}</Text>
                          <Text size="xs" c="dimmed" ff="monospace">{d.code}</Text>
                          <Badge size="sm" variant="light">{d.poids || 0} %</Badge>
                          <Text size="xs" c="dimmed">{d.criteres.length} critère(s)</Text>
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack>
                          <Group align="flex-end" gap="sm">
                            <TextInput label="Code" w={110} value={d.code} onChange={(e) => changerDomaine(i, { code: e.currentTarget.value.toUpperCase() })} error={doublon && 'En double'} disabled={lectureSeule} />
                            <TextInput label="Nom" style={{ flex: 1, minWidth: 200 }} value={d.nom} onChange={(e) => changerDomaine(i, { nom: e.currentTarget.value })} disabled={lectureSeule} />
                            <NumberInput label="Poids (%)" w={100} min={0} max={100} value={d.poids} onChange={(v) => changerDomaine(i, { poids: Number(v) || 0 })} disabled={lectureSeule} />
                            <Tooltip label="Score maximum du domaine si un critère éliminatoire n'est pas satisfait">
                              <NumberInput label="Plafond si éliminatoire" w={160} min={0} max={100} value={d.plafondSiEliminatoire ?? 40} onChange={(v) => changerDomaine(i, { plafondSiEliminatoire: Number(v) || 0 })} disabled={lectureSeule} />
                            </Tooltip>
                            {!lectureSeule && (
                              <Group gap={2}>
                                <ActionIcon variant="subtle" onClick={() => changer((b) => ({ domaines: deplacer(b.domaines, i, -1) }))} disabled={i === 0} aria-label="Monter"><IconArrowUp size={16} /></ActionIcon>
                                <ActionIcon variant="subtle" onClick={() => changer((b) => ({ domaines: deplacer(b.domaines, i, 1) }))} disabled={i === brouillon.domaines.length - 1} aria-label="Descendre"><IconArrowDown size={16} /></ActionIcon>
                                <ActionIcon variant="subtle" color="red" onClick={() => supprimerDomaine(i)} aria-label="Supprimer le domaine"><IconTrash size={16} /></ActionIcon>
                              </Group>
                            )}
                          </Group>

                          {d.criteres.length > 0 && (
                            <Table.ScrollContainer minWidth={760}>
                              <Table verticalSpacing="xs">
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>Code</Table.Th><Table.Th>Question</Table.Th><Table.Th>Type</Table.Th>
                                    <Table.Th>Pts max</Table.Th><Table.Th>Poids</Table.Th><Table.Th aria-label="Actions" />
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {d.criteres.map((c, j) => (
                                    <Table.Tr key={c._id || c.code}>
                                      <Table.Td><Text size="xs" ff="monospace">{c.code}</Text></Table.Td>
                                      <Table.Td>
                                        <Text size="sm">{c.libelle}</Text>
                                        <BadgesCritere c={c} />
                                      </Table.Td>
                                      <Table.Td><Text size="xs">{LIBELLES_TYPES_REPONSE[c.typeReponse]}</Text></Table.Td>
                                      <Table.Td><Text size="sm">{estNote(c) ? c.pointsMax : '—'}</Text></Table.Td>
                                      <Table.Td><Text size="sm">{estNote(c) ? c.poids : '—'}</Text></Table.Td>
                                      <Table.Td>
                                        <Group gap={2} wrap="nowrap">
                                          <ActionIcon variant="subtle" onClick={() => setEdition({ domaine: i, critere: j })} aria-label={lectureSeule ? 'Voir' : 'Modifier'}>
                                            {lectureSeule ? <IconEye size={16} /> : <IconEdit size={16} />}
                                          </ActionIcon>
                                          {!lectureSeule && (
                                            <>
                                              <ActionIcon variant="subtle" onClick={() => changerDomaine(i, { criteres: deplacer(d.criteres, j, -1) })} disabled={j === 0} aria-label="Monter"><IconArrowUp size={16} /></ActionIcon>
                                              <ActionIcon variant="subtle" onClick={() => changerDomaine(i, { criteres: deplacer(d.criteres, j, 1) })} disabled={j === d.criteres.length - 1} aria-label="Descendre"><IconArrowDown size={16} /></ActionIcon>
                                              <ActionIcon variant="subtle" color="red" onClick={() => supprimerCritere(i, j)} aria-label="Supprimer"><IconTrash size={16} /></ActionIcon>
                                            </>
                                          )}
                                        </Group>
                                      </Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                            </Table.ScrollContainer>
                          )}
                          {!lectureSeule && (
                            <Group>
                              <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setEdition({ domaine: i, critere: null })}>Ajouter un critère</Button>
                            </Group>
                          )}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="apercu" pt="md">
          <ApercuGrille grille={grille} modificationsNonEnregistrees={modifie} />
        </Tabs.Panel>
      </Tabs>

      {edition && (
        <ModaleCritere
          ouvert
          onFermer={() => setEdition(null)}
          critere={critereEdite}
          autresCriteres={tousCriteres.filter((c) => c !== critereEdite)}
          onValider={lectureSeule ? () => {} : validerCritere}
        />
      )}

      <Modal opened={Boolean(verification)} onClose={() => setVerification(null)} title={`Publier la version ${grille.version} ?`} size="lg">
        {verification && (
          <Stack>
            {verification.erreurs.length > 0 ? (
              <Alert color="red" icon={<IconAlertCircle />} title="À corriger avant de publier">
                <List size="sm">{verification.erreurs.map((e) => <List.Item key={e}>{e}</List.Item>)}</List>
              </Alert>
            ) : (
              <Text size="sm">
                Une fois publiée, la grille sera <b>figée</b> et proposée pour les nouvelles campagnes.
                La version publiée précédente sera archivée.
              </Text>
            )}
            {verification.avertissements.length > 0 && (
              <Alert color="orange" icon={<IconAlertTriangle />} title="Points à vérifier">
                <List size="sm">{verification.avertissements.map((e) => <List.Item key={e}>{e}</List.Item>)}</List>
              </Alert>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setVerification(null)}>Annuler</Button>
              <Button color="teal" leftSection={<IconRocket size={16} />} disabled={verification.erreurs.length > 0} loading={publier.isPending} onClick={confirmerPublication}>
                Publier
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
