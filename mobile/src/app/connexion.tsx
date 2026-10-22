import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErreurApi, messageErreur } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { Alerte, Bouton, Champ } from '@/composants/ui';
import { API_URL } from '@/config';
import { couleurs, espace } from '@/theme';

/** M1 – Connexion par téléphone (ou e-mail) et mot de passe. */
export default function Connexion() {
  const { connecter } = useAuth();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const soumettre = async () => {
    if (!identifiant.trim() || !motDePasse) {
      setErreur('Saisissez votre téléphone et votre mot de passe');
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      await connecter(identifiant.trim(), motDePasse);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: couleurs.fond }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.entete}>
            <View style={styles.logo}><Text style={styles.croix}>+</Text></View>
            <Text style={styles.titre}>Diagnostic terrain</Text>
            <Text style={styles.sousTitre}>Évaluation des centres de santé</Text>
          </View>

          {erreur && <Alerte>{erreur}</Alerte>}

          <Champ
            libelle="Téléphone ou e-mail"
            value={identifiant}
            onChangeText={setIdentifiant}
            placeholder="+235 66 00 00 00"
            keyboardType="phone-pad"
            textContentType="username"
            autoComplete="username"
            returnKeyType="next"
          />
          <Champ
            libelle="Mot de passe"
            value={motDePasse}
            onChangeText={setMotDePasse}
            secret
            textContentType="password"
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={soumettre}
          />
          <Bouton titre="Se connecter" onPress={soumettre} chargement={envoi} />

          <Text style={styles.aide}>Mot de passe oublié : contactez votre coordonnateur ou l'administrateur.</Text>
          {__DEV__ && <Text style={styles.dev}>Serveur : {API_URL}{'\n'}Démo : +235660000103 / Demo2026!</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', padding: espace.lg, gap: espace.md },
  entete: { alignItems: 'center', gap: espace.xs, marginBottom: espace.md },
  logo: { width: 56, height: 56, borderRadius: 12, backgroundColor: couleurs.primaire, alignItems: 'center', justifyContent: 'center' },
  croix: { color: '#fff', fontSize: 36, fontWeight: '800', lineHeight: 40 },
  titre: { fontSize: 24, fontWeight: '700', color: couleurs.texte, marginTop: espace.sm },
  sousTitre: { fontSize: 14, color: couleurs.texteSecondaire },
  aide: { fontSize: 13, color: couleurs.texteSecondaire, textAlign: 'center' },
  dev: { fontSize: 12, color: '#adb5bd', textAlign: 'center' },
});
