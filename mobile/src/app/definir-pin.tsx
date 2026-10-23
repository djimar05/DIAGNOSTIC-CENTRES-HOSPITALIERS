import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { LONGUEUR_PIN, pinTropSimple } from '@/auth/verrou';
import ClavierPin from '@/composants/ClavierPin';
import { Alerte } from '@/composants/ui';
import { couleurs, espace } from '@/theme';

/** M1 – Choix du code PIN de l'appareil, après la première connexion. */
export default function DefinirPin() {
  const { definirPin } = useAuth();
  const [premier, setPremier] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (code.length !== LONGUEUR_PIN) return;
    if (!premier) {
      if (pinTropSimple(code)) {
        setErreur('Code trop simple (1111, 1234…) : choisissez-en un autre');
        setCode('');
        return;
      }
      setPremier(code);
      setCode('');
      setErreur(null);
    } else if (code === premier) {
      definirPin(code); // la navigation passe ensuite à « Mes missions »
    } else {
      setErreur('Les deux codes ne correspondent pas, recommencez');
      setPremier(null);
      setCode('');
    }
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.titre}>{premier ? 'Confirmez votre code' : `Choisissez un code PIN à ${LONGUEUR_PIN} chiffres`}</Text>
      <Text style={styles.texte}>
        Il vous sera demandé à chaque ouverture de l'application et après 5 minutes d'inactivité, pour protéger les données des centres.
      </Text>
      {erreur && <Alerte>{erreur}</Alerte>}
      <ClavierPin valeur={code} onChange={setCode} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: espace.md, padding: espace.lg },
  titre: { fontSize: 20, fontWeight: '700', color: couleurs.texte, textAlign: 'center' },
  texte: { fontSize: 14, color: couleurs.texteSecondaire, textAlign: 'center' },
});
