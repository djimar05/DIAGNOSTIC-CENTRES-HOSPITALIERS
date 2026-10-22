import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { messageErreur } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { Alerte, Bouton, Champ } from '@/composants/ui';
import { couleurs, espace } from '@/theme';

/** Première connexion ou mot de passe réinitialisé : choix obligatoire d'un mot de passe personnel. */
export default function ChangerMotDePasse() {
  const { utilisateur, changerMotDePasse, deconnecter } = useAuth();
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const soumettre = async () => {
    if (!ancien) return setErreur('Saisissez le mot de passe temporaire');
    if (nouveau.length < 8) return setErreur('Le nouveau mot de passe doit contenir au moins 8 caractères');
    if (nouveau === ancien) return setErreur('Le nouveau mot de passe doit être différent du temporaire');
    if (nouveau !== confirmation) return setErreur('Les deux mots de passe ne correspondent pas');
    setErreur(null);
    setEnvoi(true);
    try {
      await changerMotDePasse(ancien, nouveau); // la navigation passe ensuite à « Mes missions »
    } catch (err) {
      setErreur(messageErreur(err));
      setEnvoi(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Alerte type="info">
        Bonjour {utilisateur?.prenom || utilisateur?.nom}, vous utilisez un mot de passe temporaire. Choisissez-en un personnel pour continuer.
      </Alerte>
      {erreur && <Alerte>{erreur}</Alerte>}
      <Champ libelle="Mot de passe temporaire" value={ancien} onChangeText={setAncien} secret />
      <Champ libelle="Nouveau mot de passe (8 caractères minimum)" value={nouveau} onChangeText={setNouveau} secret />
      <Champ libelle="Confirmer le nouveau mot de passe" value={confirmation} onChangeText={setConfirmation} secret onSubmitEditing={soumettre} />
      <Bouton titre="Enregistrer et continuer" onPress={soumettre} chargement={envoi} />
      <Text style={styles.lien} onPress={deconnecter}>Se déconnecter</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: espace.lg, gap: espace.md },
  lien: { color: couleurs.primaire, textAlign: 'center', fontWeight: '600', padding: espace.sm },
});
