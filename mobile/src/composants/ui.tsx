import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps,
} from 'react-native';
import { couleurs, espace } from '@/theme';

/** Bouton plein (principal) ou contour (secondaire), avec état de chargement. */
export function Bouton({ titre, onPress, chargement = false, desactive = false, variante = 'principal' }: {
  titre: string;
  onPress: () => void;
  chargement?: boolean;
  desactive?: boolean;
  variante?: 'principal' | 'secondaire';
}) {
  const principal = variante === 'principal';
  const inactif = desactive || chargement;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactif}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.bouton,
        principal ? styles.boutonPrincipal : styles.boutonSecondaire,
        (pressed || inactif) && { opacity: 0.6 },
      ]}
    >
      {chargement
        ? <ActivityIndicator color={principal ? '#fff' : couleurs.primaire} />
        : <Text style={[styles.texteBouton, { color: principal ? '#fff' : couleurs.primaire }]}>{titre}</Text>}
    </Pressable>
  );
}

/** Champ de saisie avec libellé ; `secret` ajoute un bouton afficher / masquer. */
export function Champ({ libelle, secret = false, erreur, ...props }: TextInputProps & { libelle: string; secret?: boolean; erreur?: string | null }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: espace.xs }}>
      <Text style={styles.libelle}>{libelle}</Text>
      <View style={[styles.champ, erreur && { borderColor: couleurs.erreur }]}>
        <TextInput
          style={styles.saisie}
          placeholderTextColor="#adb5bd"
          secureTextEntry={secret && !visible}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        {secret && (
          <Pressable onPress={() => setVisible(!visible)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.lien}>{visible ? 'Masquer' : 'Afficher'}</Text>
          </Pressable>
        )}
      </View>
      {erreur ? <Text style={styles.texteErreur}>{erreur}</Text> : null}
    </View>
  );
}

/** Encadré d'erreur ou d'information. */
export function Alerte({ children, type = 'erreur' }: { children: ReactNode; type?: 'erreur' | 'alerte' | 'info' }) {
  const teintes = {
    erreur: [couleurs.erreurClair, couleurs.erreur],
    alerte: [couleurs.alerteClair, couleurs.alerte],
    info: [couleurs.primaireClair, couleurs.primaire],
  }[type];
  return (
    <View style={[styles.alerte, { backgroundColor: teintes[0], borderColor: teintes[1] }]}>
      <Text style={{ color: teintes[1], fontSize: 14 }}>{children}</Text>
    </View>
  );
}

/** Pastille colorée (statut). */
export function Pastille({ texte, couleur }: { texte: string; couleur: string }) {
  return (
    <View style={[styles.pastille, { backgroundColor: `${couleur}22` }]}>
      <Text style={{ color: couleur, fontSize: 12, fontWeight: '600' }}>{texte}</Text>
    </View>
  );
}

/** Écran centré : chargement ou message avec action. */
export function EcranCentre({ children }: { children: ReactNode }) {
  return <View style={styles.centre}>{children}</View>;
}

const styles = StyleSheet.create({
  bouton: { minHeight: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espace.md },
  boutonPrincipal: { backgroundColor: couleurs.primaire },
  boutonSecondaire: { borderWidth: 1, borderColor: couleurs.primaire, backgroundColor: '#fff' },
  texteBouton: { fontSize: 16, fontWeight: '600' },
  libelle: { fontSize: 14, fontWeight: '500', color: couleurs.texte },
  champ: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: couleurs.bordure,
    borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: espace.md, minHeight: 48,
  },
  saisie: { flex: 1, fontSize: 16, color: couleurs.texte, paddingVertical: espace.sm },
  lien: { color: couleurs.primaire, fontWeight: '600', fontSize: 14 },
  texteErreur: { color: couleurs.erreur, fontSize: 13 },
  alerte: { borderWidth: 1, borderRadius: 8, padding: espace.md },
  pastille: { paddingHorizontal: espace.sm, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espace.lg, gap: espace.md, backgroundColor: couleurs.fond },
});
