import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Alert, Badge, Button, Card, Checkbox, Grid, Group, List, MultiSelect, NumberInput, Progress, SegmentedControl,
  Select, Stack, Text, Textarea, Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconAlertTriangle, IconEyeOff, IconInfoCircle } from '@tabler/icons-react';
import { simulerScore } from '../../api/grilles';
import { COULEURS_CLASSES } from '../../constantes/referentiel';

/** Champ de saisie selon le type de réponse, comme sur le téléphone de l'évaluateur. */
function ChampReponse({ critere, valeur, onChange }) {
  switch (critere.typeReponse) {
    case 'OUI_NON':
      return <SegmentedControl size="xs" value={valeur ?? ''} onChange={(v) => onChange(v || undefined)} data={[{ value: '', label: '—' }, 'Oui', 'Non']} />;
    case 'ECHELLE_0_3':
      return <SegmentedControl size="xs" value={valeur === undefined ? '' : String(valeur)} onChange={(v) => onChange(v === '' ? undefined : Number(v))} data={[{ value: '', label: '—' }, '0', '1', '2', '3']} />;
    case 'NOMBRE':
      return <NumberInput size="xs" w={140} value={valeur ?? ''} onChange={(v) => onChange(v === '' ? undefined : v)} placeholder="Valeur" />;
    case 'CHOIX_UNIQUE':
      return <Select size="xs" w={260} clearable value={valeur ?? null} onChange={(v) => onChange(v ?? undefined)} data={critere.options.map((o) => ({ value: o.code, label: `${o.libelle} (${o.points} pt)` }))} />;
    case 'CHOIX_MULTIPLE':
      return <MultiSelect size="xs" maw={420} value={valeur ?? []} onChange={(v) => onChange(v.length ? v : undefined)} data={critere.options.map((o) => ({ value: o.code, label: `${o.libelle} (${o.points} pt)` }))} />;
    case 'TEXTE':
      return <Textarea size="xs" autosize minRows={1} maw={420} value={valeur ?? ''} onChange={(e) => onChange(e.currentTarget.value || undefined)} />;
    default:
      return <Text size="xs" c="dimmed">Saisi sur le terrain ({critere.typeReponse.toLowerCase()})</Text>;
  }
}

/** Score global et par domaine pour les réponses saisies. */
function PanneauScore({ resultat, chargement }) {
  if (!resultat) return <Card withBorder><Text size="sm" c="dimmed">Répondez à quelques critères pour voir le score.</Text></Card>;
  const { scores, manquants, erreurs } = resultat;
  return (
    <Card withBorder style={{ opacity: chargement ? 0.6 : 1 }}>
      <Group justify="space-between" align="flex-end">
        <div>
          <Text size="xs" c="dimmed">Score global</Text>
          <Text fz={36} fw={800} lh={1}>{scores.global ?? '—'}<Text span size="sm" c="dimmed"> /100</Text></Text>
        </div>
        {scores.classe && <Badge size="xl" color={COULEURS_CLASSES[scores.classe]}>Classe {scores.classe}</Badge>}
      </Group>
      <Stack gap={8} mt="md">
        {scores.domaines.map((d) => (
          <div key={d.domaineCode}>
            <Group justify="space-between" gap="xs" wrap="nowrap">
              <Text size="xs" truncate>{d.nom} <Text span c="dimmed">({d.poids} %)</Text></Text>
              <Group gap={4} wrap="nowrap">
                {d.plafonne && <Badge size="xs" color="red" variant="light">plafonné (brut {d.scoreBrut})</Badge>}
                <Text size="xs" fw={600}>{d.score ?? '—'}</Text>
              </Group>
            </Group>
            <Progress value={d.score ?? 0} color={d.plafonne ? 'red' : 'brand'} size="sm" />
          </div>
        ))}
      </Stack>
      {manquants.length > 0 && (
        <Text size="xs" c="dimmed" mt="md">{manquants.length} critère(s) obligatoire(s) sans réponse.</Text>
      )}
      {erreurs.length > 0 && (
        <Alert color="orange" mt="sm" p="xs" icon={<IconAlertTriangle size={16} />}>
          <List size="xs">{erreurs.map((e) => <List.Item key={e}>{e}</List.Item>)}</List>
        </Alert>
      )}
    </Card>
  );
}

/**
 * Aperçu d'une grille telle que l'évaluateur la verra, avec calcul du score en direct
 * (le calcul est fait par le serveur, avec la version ENREGISTRÉE de la grille).
 */
export default function ApercuGrille({ grille, modificationsNonEnregistrees }) {
  const [reponses, setReponses] = useState({}); // code → { valeur, sansObjet }
  const [reponsesDifferees] = useDebouncedValue(reponses, 350);

  const liste = useMemo(() => Object.entries(reponsesDifferees)
    .filter(([, r]) => r.sansObjet || r.valeur !== undefined)
    .map(([critereCode, r]) => ({ critereCode, valeur: r.valeur, sansObjet: r.sansObjet })), [reponsesDifferees]);

  const { data: resultat, isFetching } = useQuery({
    queryKey: ['simulation', grille._id, grille.updatedAt, liste],
    queryFn: () => simulerScore(grille._id, liste),
    placeholderData: keepPreviousData,
  });
  const applicable = (code) => resultat?.criteres.find((c) => c.critereCode === code)?.applicable !== false;
  const modifier = (code, changement) => setReponses((r) => ({ ...r, [code]: { ...r[code], ...changement } }));

  return (
    <Stack>
      {modificationsNonEnregistrees && (
        <Alert color="orange" icon={<IconInfoCircle />}>Enregistrez la grille pour que l'aperçu tienne compte de vos dernières modifications.</Alert>
      )}
      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack>
            {grille.domaines.map((d) => (
              <Card key={d.code} withBorder>
                <Title order={5} mb="xs">{d.nom} <Text span size="xs" c="dimmed">· {d.poids} %</Text></Title>
                <Stack gap="sm">
                  {d.criteres.map((c) => {
                    const r = reponses[c.code] || {};
                    if (!applicable(c.code)) {
                      return (
                        <Group key={c.code} gap="xs" c="dimmed">
                          <IconEyeOff size={14} />
                          <Text size="xs">{c.code} – {c.libelle} (masqué : condition non remplie)</Text>
                        </Group>
                      );
                    }
                    return (
                      <div key={c.code}>
                        <Group gap={6} wrap="nowrap" align="flex-start">
                          <Text size="sm" fw={500}>
                            <Text span ff="monospace" c="dimmed" size="xs">{c.code} </Text>
                            {c.libelle}{c.obligatoire !== false && <Text span c="red"> *</Text>}
                          </Text>
                          {c.eliminatoire && <Badge size="xs" color="red" variant="light">éliminatoire</Badge>}
                        </Group>
                        {c.aide && <Text size="xs" c="dimmed">{c.aide}</Text>}
                        <Group gap="sm" mt={4}>
                          {!r.sansObjet && <ChampReponse critere={c} valeur={r.valeur} onChange={(valeur) => modifier(c.code, { valeur })} />}
                          {c.sansObjetAutorise && (
                            <Checkbox size="xs" label="Sans objet" checked={Boolean(r.sansObjet)} onChange={(e) => modifier(c.code, { sansObjet: e.currentTarget.checked })} />
                          )}
                        </Group>
                      </div>
                    );
                  })}
                </Stack>
              </Card>
            ))}
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <div style={{ position: 'sticky', top: 76 }}>
            <PanneauScore resultat={resultat} chargement={isFetching} />
            <Button variant="subtle" size="xs" mt="xs" onClick={() => setReponses({})}>Effacer les réponses</Button>
          </div>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
