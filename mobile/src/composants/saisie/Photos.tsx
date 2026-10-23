import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supprimerFichier } from '@/api/collecte';
import { entetesAuth, messageErreur } from '@/api/client';
import { API_URL } from '@/config';
import * as file from '@/hors-ligne/fileAttente';
import { couleurs, espace } from '@/theme';

/** Aperçus des photos prises pendant la session (identifiant local ou serveur → image sur le téléphone). */
const apercusLocaux = new Map<string, string>();

const LARGEUR_MAX = 1600; // pixels : lisible pour une preuve, léger à envoyer en 3G
const COMPRESSION = 0.6;

/** Réduit et compresse la photo sur le téléphone avant de la mettre en file. */
const compresser = async (uri: string, largeur: number) => {
  let contexte = ImageManipulator.ImageManipulator.manipulate(uri);
  if (largeur > LARGEUR_MAX) contexte = contexte.resize({ width: LARGEUR_MAX });
  const image = await contexte.renderAsync();
  const resultat = await image.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: COMPRESSION });
  return resultat.uri;
};

/** Dernière position connue (rapide) pour situer la photo ; facultative. */
const positionRapide = async () => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return undefined;
    const p = await Location.getLastKnownPositionAsync();
    return p ? { longitude: p.coords.longitude, latitude: p.coords.latitude, precision: p.coords.accuracy } : undefined;
  } catch {
    return undefined;
  }
};

function Vignette({ id }: { id: string }) {
  const serveur = file.resoudre([id])[0];
  const local = apercusLocaux.get(id) || apercusLocaux.get(serveur);
  if (local) return <Image source={{ uri: local }} style={styles.vignette} />;
  if (serveur.startsWith(file.PREFIXE_LOCAL)) return <View style={[styles.vignette, styles.vide]}><Text style={styles.aide}>En attente</Text></View>;
  return <Image source={{ uri: `${API_URL}/fichiers/${serveur}/contenu`, headers: entetesAuth() }} style={styles.vignette} />;
}

/**
 * Photos d'un critère (preuves) : prise, compression, mise en file chiffrée, envoi automatique.
 * `onChange` reçoit la liste des photos (identifiants serveur, ou « local:… » pour celles pas encore envoyées).
 */
export default function Photos({ evaluationId, critereCode, fichiers, onChange, desactive, exigee }: {
  evaluationId: string; critereCode: string; fichiers: string[]; onChange: (ids: string[]) => void; desactive: boolean; exigee: boolean;
}) {
  const [traitement, setTraitement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const prendre = async () => {
    setErreur(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setErreur('Autorisez l\'appareil photo dans les réglages du téléphone'); return; }
    const resultat = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (resultat.canceled || !resultat.assets?.length) return;
    setTraitement(true);
    try {
      const asset = resultat.assets[0];
      const uri = await compresser(asset.uri, asset.width);
      const idLocal = await file.ajouterPhoto({ evaluationId, critereCode, uri, gps: await positionRapide() });
      apercusLocaux.set(idLocal, uri);
      onChange([...fichiers, idLocal]);
    } catch (err) {
      setErreur(`Photo non enregistrée : ${messageErreur(err)}`);
    } finally {
      setTraitement(false);
    }
  };

  const retirer = (id: string) => Alert.alert('Supprimer cette photo ?', undefined, [
    { text: 'Annuler', style: 'cancel' },
    {
      text: 'Supprimer', style: 'destructive',
      onPress: async () => {
        try {
          const serveur = file.resoudre([id])[0];
          if (serveur.startsWith(file.PREFIXE_LOCAL)) await file.retirerPhotoLocale(serveur);
          else await supprimerFichier(serveur); // déjà envoyée : retirée aussi de la réponse côté serveur
          onChange(fichiers.filter((f) => f !== id));
        } catch (err) {
          setErreur(`Suppression impossible : ${messageErreur(err)}`);
        }
      },
    },
  ]);

  return (
    <View style={{ gap: espace.sm }}>
      <Text style={styles.titre}>Photos{exigee ? ' (preuve exigée)' : ''}</Text>
      {fichiers.length > 0 && (
        <ScrollView horizontal contentContainerStyle={{ gap: espace.sm }}>
          {fichiers.map((id) => (
            <Pressable key={id} onLongPress={() => !desactive && retirer(id)} accessibilityLabel="Photo (appui long pour supprimer)">
              <Vignette id={id} />
            </Pressable>
          ))}
        </ScrollView>
      )}
      {fichiers.length > 0 && !desactive && <Text style={styles.aide}>Appui long sur une photo pour la supprimer.</Text>}
      {erreur && <Text style={styles.erreur}>{erreur}</Text>}
      {!desactive && (
        <Pressable onPress={prendre} disabled={traitement} style={({ pressed }) => [styles.bouton, (pressed || traitement) && { opacity: 0.6 }]} accessibilityRole="button">
          {traitement ? <ActivityIndicator color={couleurs.primaire} /> : <Text style={styles.texteBouton}>📷  Prendre une photo</Text>}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: 15, fontWeight: '600', color: couleurs.texte },
  vignette: { width: 96, height: 96, borderRadius: 8, backgroundColor: couleurs.bordure },
  vide: { alignItems: 'center', justifyContent: 'center' },
  bouton: { borderWidth: 1, borderStyle: 'dashed', borderColor: couleurs.primaire, borderRadius: 10, paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff' },
  texteBouton: { fontSize: 16, fontWeight: '600', color: couleurs.primaire },
  aide: { fontSize: 12, color: couleurs.texteSecondaire },
  erreur: { fontSize: 13, color: couleurs.erreur },
});
