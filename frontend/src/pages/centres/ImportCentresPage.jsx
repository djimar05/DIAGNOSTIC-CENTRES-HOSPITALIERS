import { useState } from 'react';
import { Link } from 'react-router';
import {
  Alert, Anchor, Badge, Breadcrumbs, Button, Card, FileInput, Group, List, SegmentedControl, SimpleGrid, Stack,
  Stepper, Table, Text, ThemeIcon,
} from '@mantine/core';
import {
  IconAlertCircle, IconCheck, IconDownload, IconFileSpreadsheet, IconFlask, IconUpload,
} from '@tabler/icons-react';
import { enregistrerFichier } from '../../api/client';
import { telechargerModeleImport, useImporterCentres } from '../../api/referentiel';
import EnTetePage from '../../composants/EnTetePage';
import { messageErreur, notifierErreur } from '../../utils/erreurs';

const STATUTS = {
  CREE: { libelle: 'Créé', couleur: 'teal' },
  MIS_A_JOUR: { libelle: 'Mis à jour', couleur: 'blue' },
  INCHANGE: { libelle: 'Inchangé', couleur: 'gray' },
  ERREUR: { libelle: 'Erreur', couleur: 'red' },
};

function Compteur({ libelle, valeur, couleur }) {
  return (
    <Card withBorder padding="sm">
      <Text size="xs" c="dimmed">{libelle}</Text>
      <Text fz={26} fw={700} c={valeur ? couleur : 'dimmed'}>{valeur}</Text>
    </Card>
  );
}

/** Rapport ligne par ligne d'une simulation ou d'un import. */
function Rapport({ rapport }) {
  const [filtre, setFiltre] = useState(rapport.resume.erreurs ? 'ERREUR' : 'TOUT');
  const lignes = filtre === 'TOUT' ? rapport.lignes : rapport.lignes.filter((l) => l.statut === filtre);
  const { resume } = rapport;

  return (
    <Stack>
      <SimpleGrid cols={{ base: 2, sm: 5 }}>
        <Compteur libelle="Lignes lues" valeur={resume.total} couleur="dark" />
        <Compteur libelle={rapport.simulation ? 'À créer' : 'Créés'} valeur={resume.crees} couleur="teal" />
        <Compteur libelle={rapport.simulation ? 'À mettre à jour' : 'Mis à jour'} valeur={resume.misAJour} couleur="blue" />
        <Compteur libelle="Inchangés" valeur={resume.inchanges} couleur="gray" />
        <Compteur libelle="En erreur" valeur={resume.erreurs} couleur="red" />
      </SimpleGrid>

      <SegmentedControl
        value={filtre}
        onChange={setFiltre}
        data={[
          { value: 'TOUT', label: `Toutes (${resume.total})` },
          { value: 'ERREUR', label: `Erreurs (${resume.erreurs})` },
          { value: 'CREE', label: `Créations (${resume.crees})` },
          { value: 'MIS_A_JOUR', label: `Mises à jour (${resume.misAJour})` },
        ]}
        style={{ alignSelf: 'flex-start' }}
      />

      <Card withBorder p={0}>
        {lignes.length === 0 ? (
          <Text c="dimmed" size="sm" p="md">Aucune ligne dans cette catégorie.</Text>
        ) : (
          <Table.ScrollContainer minWidth={640} mah={480}>
            <Table verticalSpacing="xs" stickyHeader>
              <Table.Thead>
                <Table.Tr><Table.Th>Ligne</Table.Th><Table.Th>Code</Table.Th><Table.Th>Nom</Table.Th><Table.Th>Résultat</Table.Th><Table.Th>Détail</Table.Th></Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lignes.map((l) => (
                  <Table.Tr key={l.ligne}>
                    <Table.Td><Text size="sm" ff="monospace">{l.ligne}</Text></Table.Td>
                    <Table.Td><Text size="sm" ff="monospace">{l.code || '—'}</Text></Table.Td>
                    <Table.Td><Text size="sm">{l.nom || '—'}</Text></Table.Td>
                    <Table.Td><Badge color={STATUTS[l.statut].couleur} variant="light">{STATUTS[l.statut].libelle}</Badge></Table.Td>
                    <Table.Td>
                      {l.erreurs.length ? (
                        <List size="xs" c="red">{l.erreurs.map((e) => <List.Item key={e}>{e}</List.Item>)}</List>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
    </Stack>
  );
}

/**
 * W5 – Import des centres depuis le fichier Excel du ministère.
 * 1. modèle  2. simulation (contrôle sans enregistrer)  3. import des lignes valides
 */
export default function ImportCentresPage() {
  const [fichier, setFichier] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [resultat, setResultat] = useState(null);
  const [telechargement, setTelechargement] = useState(false);
  const importer = useImporterCentres();

  const etape = resultat ? 3 : simulation ? 2 : fichier ? 1 : 0;

  const telechargerModele = async () => {
    setTelechargement(true);
    try {
      enregistrerFichier(await telechargerModeleImport(), 'modele-import-centres.xlsx');
    } catch (err) {
      notifierErreur(err, 'Téléchargement impossible');
    } finally {
      setTelechargement(false);
    }
  };

  const choisirFichier = (f) => {
    setFichier(f);
    setSimulation(null);
    setResultat(null);
    importer.reset();
  };

  const lancer = async (estSimulation) => {
    try {
      const rapport = await importer.mutateAsync({ fichier, simulation: estSimulation });
      if (estSimulation) setSimulation(rapport); else setResultat(rapport);
    } catch {
      // erreur affichée sous le fichier (importer.error)
    }
  };

  const aImporter = simulation ? simulation.resume.crees + simulation.resume.misAJour : 0;

  return (
    <Stack maw={1100}>
      <Breadcrumbs>
        <Anchor component={Link} to="/centres" size="sm">Centres</Anchor>
        <Text size="sm">Import Excel</Text>
      </Breadcrumbs>
      <EnTetePage titre="Importer des centres" sousTitre="Depuis un fichier Excel (.xlsx), une ligne par centre. Un code déjà connu met le centre à jour." />

      <Stepper active={etape} size="sm" allowNextStepsSelect={false}>
        <Stepper.Step label="Fichier" description="Modèle et choix du fichier" />
        <Stepper.Step label="Simulation" description="Contrôle sans rien enregistrer" />
        <Stepper.Step label="Import" description="Enregistrement des lignes valides" />
      </Stepper>

      <Card withBorder>
        <Group align="flex-start" wrap="nowrap" gap="md">
          <ThemeIcon variant="light" size="lg"><IconFileSpreadsheet size={20} /></ThemeIcon>
          <Stack gap="xs" style={{ flex: 1 }}>
            <Text size="sm">
              Utilisez le modèle : colonnes attendues, listes de valeurs, et la feuille « Zones » avec les codes
              de zone à utiliser. Les zones doivent exister avant l'import (écran <Anchor component={Link} to="/zones" size="sm">Zones</Anchor>).
            </Text>
            <Group>
              <Button variant="light" leftSection={<IconDownload size={16} />} onClick={telechargerModele} loading={telechargement}>
                Télécharger le modèle
              </Button>
            </Group>
            <FileInput
              label="Fichier à importer"
              placeholder="Choisir un fichier .xlsx"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              leftSection={<IconUpload size={16} />}
              value={fichier}
              onChange={choisirFichier}
              clearable
              maw={420}
            />
            {importer.error && <Alert color="red" icon={<IconAlertCircle />}>{messageErreur(importer.error)}</Alert>}
            <Group>
              <Button
                leftSection={<IconFlask size={16} />}
                onClick={() => lancer(true)}
                disabled={!fichier || Boolean(resultat)}
                loading={importer.isPending && !simulation}
              >
                Simuler l'import
              </Button>
            </Group>
          </Stack>
        </Group>
      </Card>

      {simulation && !resultat && (
        <>
          <Alert color={simulation.resume.erreurs ? 'orange' : 'teal'} icon={simulation.resume.erreurs ? <IconAlertCircle /> : <IconCheck />} title="Résultat de la simulation (rien n'a été enregistré)">
            {simulation.resume.erreurs
              ? `${simulation.resume.erreurs} ligne(s) en erreur seront ignorées. Corrigez le fichier et relancez la simulation, ou importez les ${aImporter} ligne(s) valides.`
              : `Le fichier est valide : ${aImporter} centre(s) à enregistrer.`}
          </Alert>
          <Rapport rapport={simulation} />
          <Group>
            <Button color="teal" leftSection={<IconUpload size={16} />} onClick={() => lancer(false)} disabled={!aImporter} loading={importer.isPending}>
              Importer {aImporter} centre(s)
            </Button>
          </Group>
        </>
      )}

      {resultat && (
        <>
          <Alert color="teal" icon={<IconCheck />} title="Import terminé">
            {resultat.resume.crees} centre(s) créé(s), {resultat.resume.misAJour} mis à jour
            {resultat.resume.erreurs ? `, ${resultat.resume.erreurs} ligne(s) ignorée(s)` : ''}.
          </Alert>
          <Rapport rapport={resultat} />
          <Group>
            <Button component={Link} to="/centres">Voir les centres</Button>
            <Button variant="default" onClick={() => choisirFichier(null)}>Importer un autre fichier</Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
