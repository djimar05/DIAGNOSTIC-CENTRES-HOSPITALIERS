import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { messageErreur } from '@/api/client';
import { useMission } from '@/api/missions';
import { Alerte, Bouton, EcranCentre, Pastille } from '@/composants/ui';
import { couleurs, espace, STATUTS_EVALUATION } from '@/theme';
import { formatDateLongue, nomComplet } from '@/utils/format';

function Ligne({ libelle, valeur }: { libelle: string; valeur?: string | null }) {
  return (
    <View style={styles.ligne}>
      <Text style={styles.libelle}>{libelle}</Text>
      <Text style={styles.valeur}>{valeur || '—'}</Text>
    </View>
  );
}

/** M3 – Fiche d'une mission (lecture seule ; la saisie arrivera avec la collecte). */
export default function FicheMission() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: mission, isPending, error } = useMission(id);

  if (isPending) return <EcranCentre><ActivityIndicator size="large" color={couleurs.primaire} /></EcranCentre>;
  if (error || !mission) return <EcranCentre><Alerte>{messageErreur(error)}</Alerte></EcranCentre>;

  const statut = STATUTS_EVALUATION[mission.evaluation?.statut || 'PLANIFIEE'];
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: mission.centre.code || 'Mission' }} />
      <View style={styles.carte}>
        <Text style={styles.titre}>{mission.centre.nom}</Text>
        <Pastille texte={statut.libelle} couleur={statut.couleur} />
        <Ligne libelle="Zone" valeur={mission.centre.zone?.nom} />
        <Ligne libelle="Visite prévue" valeur={formatDateLongue(mission.datePrevue)} />
        <Ligne libelle="Campagne" valeur={mission.campagne.nom} />
      </View>

      <View style={styles.carte}>
        <Text style={styles.sousTitre}>Équipe</Text>
        <Ligne libelle="Évaluateurs" valeur={mission.evaluateurs.map(nomComplet).join(', ')} />
        <Ligne libelle="Superviseur" valeur={nomComplet(mission.superviseur)} />
        {mission.superviseur?.telephone && <Ligne libelle="Tél. superviseur" valeur={mission.superviseur.telephone} />}
      </View>

      <Bouton titre="Commencer l'évaluation" onPress={() => {}} desactive />
      <Text style={styles.note}>La saisie de la grille sur le terrain arrivera dans la prochaine version.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: espace.md, gap: espace.md },
  carte: { backgroundColor: couleurs.carte, borderRadius: 10, padding: espace.md, gap: espace.sm, borderWidth: 1, borderColor: couleurs.bordure },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte },
  sousTitre: { fontSize: 16, fontWeight: '600', color: couleurs.texte },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', gap: espace.md },
  libelle: { fontSize: 14, color: couleurs.texteSecondaire },
  valeur: { fontSize: 14, color: couleurs.texte, flexShrink: 1, textAlign: 'right' },
  note: { fontSize: 13, color: couleurs.texteSecondaire, textAlign: 'center' },
});
