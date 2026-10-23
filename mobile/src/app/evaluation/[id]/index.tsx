import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { enregistrerObservationsGenerales, useEvaluation, useGrille, useMissionDeLEvaluation } from '@/api/collecte';
import { messageErreur } from '@/api/client';
import { Alerte, Bouton, EcranCentre } from '@/composants/ui';
import { fusionnerReponses, useEnAttente } from '@/hors-ligne/SynchroProvider';
import { STATUTS_MODIFIABLES, indexer, progressionDomaine } from '@/logique/grille';
import { couleurs, espace } from '@/theme';

/** M4 – Sommaire de l'évaluation : progression par domaine, accès aux critères et au récapitulatif. */
export default function Sommaire() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: evaluation, isPending, error } = useEvaluation(id);
  const { data: grille, isPending: chargementGrille } = useGrille(evaluation?.grille);
  const { mission } = useMissionDeLEvaluation(id);
  const [observations, setObservations] = useState('');
  const [etatObservations, setEtatObservations] = useState<string | null>(null);

  useEffect(() => { if (evaluation) setObservations(evaluation.observationsGenerales || ''); }, [evaluation?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const enAttente = useEnAttente(id);
  const reponses = useMemo(() => indexer(fusionnerReponses(evaluation?.reponses, enAttente.reponses)), [evaluation, enAttente.reponses]);
  const domaines = useMemo(() => (grille ? grille.domaines.map((d) => ({ domaine: d, ...progressionDomaine(d, reponses) })) : []), [grille, reponses]);

  if (isPending || chargementGrille) return <EcranCentre><ActivityIndicator size="large" color={couleurs.primaire} /></EcranCentre>;
  if (error || !evaluation || !grille) return <EcranCentre><Alerte>{messageErreur(error)}</Alerte></EcranCentre>;

  const modifiable = STATUTS_MODIFIABLES.includes(evaluation.statut);
  const total = domaines.reduce((s, d) => s + d.total, 0);
  const repondus = domaines.reduce((s, d) => s + d.repondus, 0);
  const ouvrir = (code: string) => router.push({ pathname: '/evaluation/[id]/critere/[code]', params: { id, code } });

  const sauverObservations = async () => {
    if (!modifiable || observations === (evaluation.observationsGenerales || '')) return;
    setEtatObservations('Enregistrement…');
    try {
      await enregistrerObservationsGenerales(id, observations);
      setEtatObservations('Enregistré');
    } catch (err) {
      setEtatObservations(messageErreur(err));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: mission?.centre.nom || 'Évaluation' }} />

      {!modifiable && <Alerte type="info">Évaluation envoyée : lecture seule.</Alerte>}
      {enAttente.total > 0 && (
        <Alerte type={enAttente.bloques.length ? 'erreur' : 'alerte'}>
          {enAttente.bloques.length
            ? `${enAttente.bloques.length} élément(s) refusé(s) par le serveur : ouvrez le critère concerné.`
            : `${enAttente.total} élément(s) enregistré(s) sur le téléphone, en attente d'envoi (reprise automatique dès le retour du réseau).`}
        </Alerte>
      )}
      {evaluation.statut === 'A_CORRIGER' && evaluation.validation?.motif && (
        <Alerte type="alerte">À corriger : {evaluation.validation.motif}</Alerte>
      )}

      <View style={styles.carte}>
        <Text style={styles.sousTitre}>Progression : {repondus} / {total} critères</Text>
        <View style={styles.barre}><View style={[styles.remplissage, { width: `${total ? (repondus / total) * 100 : 0}%` }]} /></View>
      </View>

      {domaines.map(({ domaine, total: t, repondus: r, aCompleter, premierACompleter }) => (
        <Pressable
          key={domaine.code}
          onPress={() => ouvrir(premierACompleter || domaine.criteres[0].code)}
          style={({ pressed }) => [styles.domaine, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.nomDomaine}>{domaine.nom}</Text>
            <View style={styles.barre}><View style={[styles.remplissage, { width: `${t ? (r / t) * 100 : 0}%`, backgroundColor: aCompleter ? couleurs.primaire : couleurs.succes }]} /></View>
          </View>
          <Text style={[styles.compte, !aCompleter && { color: couleurs.succes }]}>{aCompleter ? `${r}/${t}` : '✓'}</Text>
        </Pressable>
      ))}

      <View style={styles.carte}>
        <Text style={styles.sousTitre}>Observations générales</Text>
        <TextInput
          style={styles.zoneTexte}
          multiline
          editable={modifiable}
          value={observations}
          onChangeText={(t) => { setObservations(t); setEtatObservations(null); }}
          onBlur={sauverObservations}
          placeholder="Contexte de la visite, difficultés rencontrées…"
          placeholderTextColor="#adb5bd"
        />
        {etatObservations && <Text style={styles.etat}>{etatObservations}</Text>}
      </View>

      <Bouton
        titre={modifiable ? 'Récapitulatif et envoi' : 'Voir le récapitulatif'}
        onPress={() => router.push({ pathname: '/evaluation/[id]/recapitulatif', params: { id } })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: espace.md, gap: espace.sm, paddingBottom: espace.lg * 2 },
  carte: { backgroundColor: couleurs.carte, borderRadius: 10, padding: espace.md, gap: espace.sm, borderWidth: 1, borderColor: couleurs.bordure },
  sousTitre: { fontSize: 16, fontWeight: '600', color: couleurs.texte },
  barre: { height: 8, borderRadius: 4, backgroundColor: couleurs.bordure, overflow: 'hidden' },
  remplissage: { height: 8, borderRadius: 4, backgroundColor: couleurs.primaire },
  domaine: {
    flexDirection: 'row', alignItems: 'center', gap: espace.md, backgroundColor: couleurs.carte,
    borderRadius: 10, padding: espace.md, borderWidth: 1, borderColor: couleurs.bordure,
  },
  nomDomaine: { fontSize: 15, fontWeight: '500', color: couleurs.texte },
  compte: { fontSize: 15, fontWeight: '700', color: couleurs.texteSecondaire, minWidth: 44, textAlign: 'right' },
  zoneTexte: { minHeight: 80, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 8, padding: espace.sm, fontSize: 15, textAlignVertical: 'top', color: couleurs.texte },
  etat: { fontSize: 12, color: couleurs.texteSecondaire },
});
