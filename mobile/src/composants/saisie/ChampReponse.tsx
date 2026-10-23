import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import type { Critere } from '@/api/types';
import { horsBareme, libelleBareme } from '@/logique/grille';
import { couleurs, espace } from '@/theme';

type Props = { critere: Critere; valeur: unknown; onChange: (valeur: unknown) => void; desactive: boolean };

/** Gros boutons à choix (Oui/Non, échelle, options) : utilisables d'une main, en plein soleil. */
function Choix({ options, selection, onPress, desactive, multiple = false }: {
  options: { valeur: string | number; libelle: string; detail?: string }[];
  selection: (string | number)[];
  onPress: (v: string | number) => void;
  desactive: boolean;
  multiple?: boolean;
}) {
  return (
    <View style={{ gap: espace.sm }}>
      {options.map((o) => {
        const choisi = selection.some((s) => String(s) === String(o.valeur));
        return (
          <Pressable
            key={String(o.valeur)}
            onPress={() => onPress(o.valeur)}
            disabled={desactive}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: choisi, disabled: desactive }}
            style={({ pressed }) => [styles.choix, choisi && styles.choixActif, (pressed || desactive) && { opacity: 0.6 }]}
          >
            <Text style={[styles.texteChoix, choisi && { color: '#fff' }]}>{multiple ? (choisi ? '☑ ' : '☐ ') : ''}{o.libelle}</Text>
            {o.detail ? <Text style={[styles.detailChoix, choisi && { color: '#e3fafc' }]}>{o.detail}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Saisie libre validée à la sortie du champ (nombre, texte, date). */
function SaisieLibre({ valeur, onValider, desactive, type }: { valeur: unknown; onValider: (texte: string) => string | null; desactive: boolean; type: 'nombre' | 'texte' | 'date' }) {
  const [texte, setTexte] = useState(valeur === undefined || valeur === null ? '' : String(valeur));
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => { setTexte(valeur === undefined || valeur === null ? '' : String(valeur)); }, [valeur]);
  return (
    <View style={{ gap: espace.xs }}>
      <TextInput
        style={[styles.saisie, type === 'texte' && styles.multiligne, erreur && { borderColor: couleurs.erreur }]}
        value={texte}
        editable={!desactive}
        onChangeText={(t) => { setTexte(t); setErreur(null); }}
        onBlur={() => setErreur(onValider(texte))}
        keyboardType={type === 'nombre' ? 'decimal-pad' : type === 'date' ? 'numbers-and-punctuation' : 'default'}
        multiline={type === 'texte'}
        placeholder={type === 'nombre' ? 'Valeur' : type === 'date' ? 'AAAA-MM-JJ' : 'Votre réponse'}
        placeholderTextColor="#adb5bd"
        returnKeyType="done"
      />
      {erreur && <Text style={erreur.startsWith('⚠') ? styles.alerte : styles.erreur}>{erreur}</Text>}
    </View>
  );
}

/** Champ de réponse adapté au type du critère (M5). */
export default function ChampReponse({ critere, valeur, onChange, desactive }: Props) {
  const [releve, setReleve] = useState(false);

  switch (critere.typeReponse) {
    case 'OUI_NON':
      return <Choix options={[{ valeur: 'Oui', libelle: 'Oui' }, { valeur: 'Non', libelle: 'Non' }]} selection={valeur ? [valeur as string] : []} onPress={onChange} desactive={desactive} />;

    case 'ECHELLE_0_3':
      return (
        <Choix
          options={[
            { valeur: 0, libelle: '0', detail: 'Absent / très insuffisant' }, { valeur: 1, libelle: '1', detail: 'Insuffisant' },
            { valeur: 2, libelle: '2', detail: 'Partiellement conforme' }, { valeur: 3, libelle: '3', detail: 'Conforme' },
          ]}
          selection={valeur === undefined || valeur === null ? [] : [valeur as number]}
          onPress={(v) => onChange(Number(v))}
          desactive={desactive}
        />
      );

    case 'CHOIX_UNIQUE':
      return <Choix options={(critere.options || []).map((o) => ({ valeur: o.code, libelle: o.libelle }))} selection={valeur ? [valeur as string] : []} onPress={onChange} desactive={desactive} />;

    case 'CHOIX_MULTIPLE': {
      const selection = Array.isArray(valeur) ? (valeur as string[]) : [];
      return (
        <Choix
          multiple
          options={(critere.options || []).map((o) => ({ valeur: o.code, libelle: o.libelle }))}
          selection={selection}
          onPress={(v) => onChange(selection.includes(String(v)) ? selection.filter((s) => s !== v) : [...selection, String(v)])}
          desactive={desactive}
        />
      );
    }

    case 'NOMBRE':
      return (
        <View style={{ gap: espace.xs }}>
          <SaisieLibre
            type="nombre"
            valeur={valeur}
            desactive={desactive}
            onValider={(texte) => {
              if (!texte.trim()) { onChange(null); return null; }
              const n = Number(texte.replace(',', '.').replace(/\s/g, ''));
              if (!Number.isFinite(n)) return 'Nombre invalide';
              onChange(n);
              return horsBareme(critere, n) ? '⚠ Valeur inhabituelle : vérifiez la saisie' : null;
            }}
          />
          {critere.bareme?.seuils?.length ? <Text style={styles.aide}>Barème : {libelleBareme(critere)}</Text> : null}
        </View>
      );

    case 'TEXTE':
      return <SaisieLibre type="texte" valeur={valeur} desactive={desactive} onValider={(t) => { onChange(t.trim() || null); return null; }} />;

    case 'DATE':
      return (
        <SaisieLibre
          type="date"
          valeur={valeur}
          desactive={desactive}
          onValider={(t) => {
            if (!t.trim()) { onChange(null); return null; }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(t.trim()) || Number.isNaN(Date.parse(t.trim()))) return 'Date au format AAAA-MM-JJ';
            onChange(t.trim());
            return null;
          }}
        />
      );

    case 'GPS': {
      const coords = (valeur as { coordinates?: number[] } | null)?.coordinates;
      const relever = async () => {
        setReleve(true);
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const { coords: c } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            onChange({ type: 'Point', coordinates: [c.longitude, c.latitude] });
          }
        } finally {
          setReleve(false);
        }
      };
      return (
        <View style={{ gap: espace.sm }}>
          {coords && <Text style={styles.aide}>Position relevée : {coords[1].toFixed(5)}, {coords[0].toFixed(5)}</Text>}
          <Pressable onPress={relever} disabled={desactive || releve} style={[styles.choix, { alignItems: 'center' }]} accessibilityRole="button">
            {releve ? <ActivityIndicator color={couleurs.primaire} /> : <Text style={styles.texteChoix}>{coords ? 'Relever à nouveau' : 'Relever la position'}</Text>}
          </Pressable>
        </View>
      );
    }

    case 'PHOTO':
      return <Text style={styles.aide}>La réponse à ce critère est la photo : prenez-la ci-dessous.</Text>;

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  choix: { borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 14, paddingHorizontal: espace.md },
  choixActif: { backgroundColor: couleurs.primaire, borderColor: couleurs.primaire },
  texteChoix: { fontSize: 17, fontWeight: '600', color: couleurs.texte },
  detailChoix: { fontSize: 13, color: couleurs.texteSecondaire, marginTop: 2 },
  saisie: { borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 8, backgroundColor: '#fff', padding: espace.md, fontSize: 17, color: couleurs.texte },
  multiligne: { minHeight: 100, textAlignVertical: 'top' },
  aide: { fontSize: 13, color: couleurs.texteSecondaire },
  erreur: { fontSize: 13, color: couleurs.erreur },
  alerte: { fontSize: 13, color: couleurs.alerte },
});
