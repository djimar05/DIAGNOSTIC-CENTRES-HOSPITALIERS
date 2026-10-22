import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import type { Mission } from '@/api/types';
import { Pastille } from '@/composants/ui';
import { couleurs, espace, STATUTS_EVALUATION } from '@/theme';
import { formatDate } from '@/utils/format';

/** Une mission dans la liste « Mes missions ». */
export default function CarteMission({ mission, enRetard }: { mission: Mission; enRetard: boolean }) {
  const statut = STATUTS_EVALUATION[mission.evaluation?.statut || 'PLANIFIEE'];
  return (
    <Link href={{ pathname: '/mission/[id]', params: { id: mission._id } }} asChild>
      <Pressable style={({ pressed }) => [styles.carte, pressed && { opacity: 0.7 }]} accessibilityRole="button">
        <View style={styles.ligne}>
          <Text style={styles.nom} numberOfLines={2}>{mission.centre.nom}</Text>
          <Pastille texte={statut.libelle} couleur={statut.couleur} />
        </View>
        <Text style={styles.detail}>{mission.centre.code} · {mission.centre.zone?.nom}</Text>
        <View style={styles.ligne}>
          <Text style={[styles.date, enRetard && { color: couleurs.erreur, fontWeight: '700' }]}>
            {formatDate(mission.datePrevue)}{enRetard ? ' · en retard' : ''}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>{mission.campagne.nom}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: couleurs.carte, borderRadius: 10, padding: espace.md, gap: espace.xs,
    borderWidth: 1, borderColor: couleurs.bordure,
  },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espace.sm },
  nom: { fontSize: 16, fontWeight: '600', color: couleurs.texte, flexShrink: 1 },
  detail: { fontSize: 13, color: couleurs.texteSecondaire, flexShrink: 1 },
  date: { fontSize: 14, color: couleurs.texte },
});
