import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useDemarrer, useMissionMobile } from '@/api/collecte';
import { messageErreur } from '@/api/client';
import type { Gps } from '@/api/types';
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

/** Position actuelle, ou null si refusée / indisponible (la visite peut démarrer quand même). */
const positionActuelle = async (): Promise<Gps | null> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  try {
    const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { type: 'Point', coordinates: [coords.longitude, coords.latitude], precisionMetres: coords.accuracy ?? undefined };
  } catch {
    return null;
  }
};

/** M3 – Fiche de la mission et du centre ; démarrage de la visite avec relevé GPS. */
export default function FicheMission() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { mission, isPending, error } = useMissionMobile(id);
  const demarrer = useDemarrer();
  const [releveGps, setReleveGps] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (isPending) return <EcranCentre><ActivityIndicator size="large" color={couleurs.primaire} /></EcranCentre>;
  if (error || !mission) return <EcranCentre><Alerte>{error ? messageErreur(error) : 'Mission introuvable (actualisez la liste)'}</Alerte></EcranCentre>;

  const evaluation = mission.evaluation;
  const statut = evaluation?.statut || 'PLANIFIEE';
  const versSaisie = () => router.push({ pathname: '/evaluation/[id]', params: { id: evaluation!._id } });

  const lancer = async () => {
    if (!evaluation) return;
    setErreur(null);
    setReleveGps(true);
    const gps = await positionActuelle();
    setReleveGps(false);
    const confirmer = () => demarrer.mutate({ id: evaluation._id, gps: gps || undefined }, {
      onSuccess: versSaisie,
      onError: (e) => setErreur(messageErreur(e)),
    });
    if (gps) confirmer();
    else {
      Alert.alert('Position GPS indisponible', 'La position prouve que la visite a eu lieu sur place. Démarrer quand même sans position ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Démarrer sans GPS', onPress: confirmer },
      ]);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: mission.centre.code || 'Mission' }} />
      <View style={styles.carte}>
        <Text style={styles.titre}>{mission.centre.nom}</Text>
        <Pastille texte={STATUTS_EVALUATION[statut].libelle} couleur={STATUTS_EVALUATION[statut].couleur} />
        <Ligne libelle="Zone" valeur={mission.centre.zone?.nom} />
        <Ligne libelle="Localité" valeur={mission.centre.localite} />
        <Ligne libelle="Visite prévue" valeur={formatDateLongue(mission.datePrevue)} />
        <Ligne libelle="Campagne" valeur={mission.campagne.nom} />
        <Ligne libelle="Responsable du centre" valeur={[mission.centre.responsable?.nom, mission.centre.responsable?.telephone].filter(Boolean).join(' · ')} />
      </View>

      <View style={styles.carte}>
        <Text style={styles.sousTitre}>Équipe</Text>
        <Ligne libelle="Évaluateurs" valeur={mission.evaluateurs.map(nomComplet).join(', ')} />
        <Ligne libelle="Superviseur" valeur={[nomComplet(mission.superviseur), mission.superviseur?.telephone].filter(Boolean).join(' · ')} />
      </View>

      {statut === 'A_CORRIGER' && evaluation?.motifCorrection && (
        <Alerte type="alerte">Renvoyée par le superviseur : {evaluation.motifCorrection}</Alerte>
      )}
      {erreur && <Alerte>{erreur}</Alerte>}

      {statut === 'PLANIFIEE' && (
        <>
          <Bouton titre={releveGps ? 'Relevé de la position…' : 'Démarrer la visite'} onPress={lancer} chargement={releveGps || demarrer.isPending} />
          <Text style={styles.note}>À faire sur place : la position GPS et l'heure de début sont enregistrées.</Text>
        </>
      )}
      {['EN_COURS', 'A_CORRIGER'].includes(statut) && <Bouton titre="Continuer la saisie" onPress={versSaisie} />}
      {['SOUMISE', 'VALIDEE', 'PUBLIEE'].includes(statut) && <Bouton titre="Voir l'évaluation envoyée" variante="secondaire" onPress={versSaisie} />}
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
