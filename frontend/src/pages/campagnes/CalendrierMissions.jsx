import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Box, Button, Card, Group, SimpleGrid, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { STATUTS_EVALUATION, estEnRetard, nomsEquipe } from '../../constantes/planification';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const formatMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const cleJour = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
// Date de visite : jour du calendrier stocké à minuit UTC → on lit ses composantes UTC (voir formatDatePrevue)
const cleJourPrevu = (iso) => { const d = new Date(iso); return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`; };
const MAX_PAR_JOUR = 3;

/** Les 6 semaines (lundi → dimanche) qui couvrent le mois. */
const semainesDuMois = (annee, mois) => {
  const premier = new Date(annee, mois, 1);
  const decalage = (premier.getDay() + 6) % 7; // lundi = 0
  return Array.from({ length: 42 }, (_, i) => new Date(annee, mois, 1 - decalage + i));
};

/** W8 – Calendrier mensuel des visites prévues. Un clic sur une mission ouvre son équipe. */
export default function CalendrierMissions({ missions, onChoisir }) {
  const datees = missions.filter((m) => m.datePrevue);
  const nonPlanifiees = missions.filter((m) => !m.datePrevue && m.statut !== 'ANNULEE');

  // Mois affiché par défaut : celui de la prochaine visite, sinon le mois courant
  const [mois, setMois] = useState(() => {
    const prochaine = datees.map((m) => new Date(m.datePrevue)).filter((d) => d >= new Date()).sort((a, b) => a - b)[0]
      || (datees[0] && new Date(datees[0].datePrevue)) || new Date();
    return new Date(prochaine.getFullYear(), prochaine.getMonth(), 1);
  });

  const parJour = useMemo(() => {
    const groupes = new Map();
    datees.forEach((m) => { const k = cleJourPrevu(m.datePrevue); groupes.set(k, [...(groupes.get(k) || []), m]); });
    return groupes;
  }, [datees]);

  const jours = semainesDuMois(mois.getFullYear(), mois.getMonth());
  const aujourdhui = cleJour(new Date());
  const changerMois = (n) => setMois((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <ActionIcon variant="default" onClick={() => changerMois(-1)} aria-label="Mois précédent"><IconChevronLeft size={16} /></ActionIcon>
          <ActionIcon variant="default" onClick={() => changerMois(1)} aria-label="Mois suivant"><IconChevronRight size={16} /></ActionIcon>
          <Button variant="subtle" size="xs" onClick={() => { const d = new Date(); setMois(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Aujourd'hui</Button>
        </Group>
        <Text fw={600} tt="capitalize">{formatMois.format(mois)}</Text>
      </Group>

      <Card withBorder p={0} style={{ overflowX: 'auto' }}>
        <Box miw={700}>
          <SimpleGrid cols={7} spacing={0}>
            {JOURS.map((j) => <Text key={j} size="xs" fw={600} ta="center" py={6} bg="var(--mantine-color-gray-0)">{j}</Text>)}
            {jours.map((jour) => {
              const liste = parJour.get(cleJour(jour)) || [];
              const horsMois = jour.getMonth() !== mois.getMonth();
              return (
                <Box key={jour.toISOString()} p={4} mih={92} style={{
                  borderTop: '1px solid var(--mantine-color-gray-2)', borderLeft: '1px solid var(--mantine-color-gray-2)',
                  opacity: horsMois ? 0.45 : 1,
                  background: cleJour(jour) === aujourdhui ? 'var(--mantine-color-brand-0)' : undefined,
                }}>
                  <Text size="xs" c="dimmed" ta="right">{jour.getDate()}</Text>
                  <Stack gap={2}>
                    {liste.slice(0, MAX_PAR_JOUR).map((m) => {
                      const statut = STATUTS_EVALUATION[m.evaluation?.statut || 'PLANIFIEE'];
                      return (
                        <Tooltip key={m._id} label={`${m.centre.nom} · ${statut.libelle} · ${nomsEquipe(m.evaluateurs) || 'sans équipe'}`} multiline w={240}>
                          <UnstyledButton onClick={() => onChoisir?.(m)}>
                            <Badge size="xs" fullWidth radius="sm" variant={estEnRetard(m) ? 'filled' : 'light'} color={estEnRetard(m) ? 'red' : statut.couleur} styles={{ label: { textTransform: 'none' } }}>
                              {m.centre.nom}
                            </Badge>
                          </UnstyledButton>
                        </Tooltip>
                      );
                    })}
                    {liste.length > MAX_PAR_JOUR && <Text size="xs" c="dimmed">+{liste.length - MAX_PAR_JOUR} autre(s)</Text>}
                  </Stack>
                </Box>
              );
            })}
          </SimpleGrid>
        </Box>
      </Card>

      {nonPlanifiees.length > 0 && (
        <Card withBorder>
          <Text size="sm" fw={600} mb="xs">{nonPlanifiees.length} visite(s) sans date</Text>
          <Group gap={6}>
            {nonPlanifiees.map((m) => (
              <UnstyledButton key={m._id} onClick={() => onChoisir?.(m)}>
                <Badge variant="outline" color="orange" styles={{ label: { textTransform: 'none' } }}>{m.centre.nom}</Badge>
              </UnstyledButton>
            ))}
          </Group>
        </Card>
      )}
    </Stack>
  );
}
