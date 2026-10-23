import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { LONGUEUR_PIN } from '@/auth/verrou';
import { couleurs, espace } from '@/theme';
import ClavierPin from './ClavierPin';

/**
 * M1 – Verrouillage : recouvre l'application (la navigation en cours est conservée) jusqu'au bon PIN.
 * Après trop d'essais faux, AuthProvider déconnecte l'utilisateur.
 */
export default function EcranVerrou() {
  const { utilisateur, deverrouiller, essaisRestants, deconnecter } = useAuth();
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);

  useEffect(() => {
    if (code.length !== LONGUEUR_PIN) return;
    setVerification(true);
    deverrouiller(code).then((ok) => {
      if (!ok) {
        setErreur(`Code incorrect. ${essaisRestants - 1} essai(s) restant(s) avant déconnexion.`);
        setCode('');
      }
      setVerification(false);
    });
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={[StyleSheet.absoluteFill, styles.fond]}>
      <View style={styles.page}>
        <Text style={styles.titre}>Application verrouillée</Text>
        <Text style={styles.texte}>{utilisateur?.prenom || utilisateur?.nom}, saisissez votre code PIN</Text>
        {erreur && <Text style={styles.erreur}>{erreur}</Text>}
        <ClavierPin valeur={code} onChange={(v) => { setErreur(null); setCode(v); }} desactive={verification} />
        <Text style={styles.lien} onPress={deconnecter}>Code oublié ? Se reconnecter avec le mot de passe</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fond: { backgroundColor: couleurs.fond, zIndex: 10 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espace.md, padding: espace.lg },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte },
  texte: { fontSize: 15, color: couleurs.texteSecondaire, textAlign: 'center' },
  erreur: { fontSize: 14, color: couleurs.erreur, textAlign: 'center' },
  lien: { color: couleurs.primaire, fontWeight: '600', textAlign: 'center', marginTop: espace.md },
});
