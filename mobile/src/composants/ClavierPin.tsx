import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LONGUEUR_PIN } from '@/auth/verrou';
import { couleurs, espace } from '@/theme';

/** Pastilles du code saisi + pavé numérique (grandes touches, utilisables avec des gants ou en plein soleil). */
export default function ClavierPin({ valeur, onChange, desactive = false }: { valeur: string; onChange: (v: string) => void; desactive?: boolean }) {
  const touche = (t: string) => {
    if (desactive) return;
    if (t === '⌫') onChange(valeur.slice(0, -1));
    else if (t && valeur.length < LONGUEUR_PIN) onChange(valeur + t);
  };
  return (
    <View style={{ gap: espace.lg, alignItems: 'center' }}>
      <View style={styles.pastilles} accessibilityLabel={`${valeur.length} chiffres saisis sur ${LONGUEUR_PIN}`}>
        {Array.from({ length: LONGUEUR_PIN }, (_, i) => (
          <View key={i} style={[styles.pastille, i < valeur.length && styles.pastillePleine]} />
        ))}
      </View>
      <View style={styles.pave}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((t, i) => (
          <Pressable
            key={i}
            onPress={() => touche(t)}
            disabled={!t || desactive}
            accessibilityRole="button"
            accessibilityLabel={t === '⌫' ? 'Effacer' : t}
            style={({ pressed }) => [styles.touche, !t && { opacity: 0 }, pressed && { backgroundColor: couleurs.primaireClair }]}
          >
            <Text style={styles.texteTouche}>{t}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pastilles: { flexDirection: 'row', gap: espace.md },
  pastille: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: couleurs.primaire },
  pastillePleine: { backgroundColor: couleurs.primaire },
  pave: { flexDirection: 'row', flexWrap: 'wrap', width: 264, gap: 12, justifyContent: 'center' },
  touche: { width: 76, height: 64, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: couleurs.bordure, alignItems: 'center', justifyContent: 'center' },
  texteTouche: { fontSize: 26, fontWeight: '600', color: couleurs.texte },
});
