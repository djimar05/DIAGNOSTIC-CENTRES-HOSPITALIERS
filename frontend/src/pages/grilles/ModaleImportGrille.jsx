import { useEffect, useState } from 'react';
import { Alert, Button, FileInput, Group, List, Modal, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle, IconCheck, IconFlask, IconUpload } from '@tabler/icons-react';
import { useImporterGrille } from '../../api/grilles';
import { messageErreur } from '../../utils/erreurs';

function Chiffre({ libelle, valeur, couleur }) {
  return (
    <div>
      <Text size="xs" c="dimmed">{libelle}</Text>
      <Text fw={700} fz="xl" c={couleur}>{valeur}</Text>
    </div>
  );
}

/**
 * Import de la grille officielle (.xlsx ou .json, format de l'export).
 * Simulation d'abord, puis création d'un brouillon à relire et publier dans l'éditeur.
 */
export default function ModaleImportGrille({ ouvert, onFermer, onImportee }) {
  const importer = useImporterGrille();
  const [fichier, setFichier] = useState(null);
  const [rapport, setRapport] = useState(null);

  useEffect(() => {
    if (ouvert) { setFichier(null); setRapport(null); importer.reset(); }
  }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const lancer = async (simulation) => {
    try {
      const r = await importer.mutateAsync({ fichier, simulation });
      setRapport(r);
      if (r.enregistree) onImportee(r.grille);
    } catch {
      // affiché via importer.error
    }
  };

  return (
    <Modal opened={ouvert} onClose={onFermer} title="Importer une grille" size="lg">
      <Stack>
        <Text size="sm">
          Fichier Excel (.xlsx) ou JSON au format de l'export d'une grille : exportez une grille existante pour obtenir
          un modèle. La grille importée est créée en <b>brouillon</b> ; vous la relirez avant de la publier.
        </Text>
        <FileInput
          label="Fichier"
          placeholder="Choisir un fichier .xlsx ou .json"
          accept=".xlsx,.json"
          leftSection={<IconUpload size={16} />}
          value={fichier}
          onChange={(f) => { setFichier(f); setRapport(null); importer.reset(); }}
          clearable
        />
        {importer.error && <Alert color="red" icon={<IconAlertCircle />}>{messageErreur(importer.error)}</Alert>}

        {rapport && (
          <>
            <SimpleGrid cols={4}>
              <Chiffre libelle="Grille" valeur={`${rapport.grille.code || '?'} v${rapport.grille.version}`} />
              <Chiffre libelle="Domaines" valeur={rapport.resume.domaines} />
              <Chiffre libelle="Critères" valeur={rapport.resume.criteres} />
              <Chiffre libelle="Total des poids" valeur={`${rapport.resume.totalPoids} %`} couleur={rapport.resume.totalPoids === 100 ? 'teal' : 'orange'} />
            </SimpleGrid>
            {rapport.erreurs.length > 0 && (
              <Alert color="red" icon={<IconAlertCircle />} title="Erreurs : la grille ne peut pas être importée">
                <List size="sm">{rapport.erreurs.map((e) => <List.Item key={e}>{e}</List.Item>)}</List>
              </Alert>
            )}
            {rapport.avertissements.length > 0 && (
              <Alert color="orange" icon={<IconAlertTriangle />} title="À vérifier">
                <List size="sm">{rapport.avertissements.map((e) => <List.Item key={e}>{e}</List.Item>)}</List>
              </Alert>
            )}
            {rapport.simulation && !rapport.erreurs.length && (
              <Alert color="teal" icon={<IconCheck />}>Le fichier est lisible. Importez-le pour créer le brouillon.</Alert>
            )}
          </>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onFermer}>Fermer</Button>
          <Button variant="light" leftSection={<IconFlask size={16} />} disabled={!fichier} loading={importer.isPending && !rapport} onClick={() => lancer(true)}>
            Vérifier
          </Button>
          <Button
            leftSection={<IconUpload size={16} />}
            disabled={!rapport?.simulation || rapport.erreurs.length > 0}
            loading={importer.isPending && Boolean(rapport)}
            onClick={() => lancer(false)}
          >
            Importer en brouillon
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
