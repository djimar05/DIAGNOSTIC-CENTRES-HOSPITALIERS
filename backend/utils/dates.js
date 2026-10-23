/**
 * Dates « calendaires » (date de visite prévue d'une mission) : un jour, sans heure,
 * stocké à minuit UTC de ce jour — ISODate("2026-12-08"), comme l'envoie un <input type="date">.
 * Comparées jour à jour, elles donnent le même résultat quel que soit le fuseau de l'appareil.
 */

/** Ramène une date (ou "2026-12-08") à minuit UTC de son jour. */
const jourCalendaire = (valeur) => {
  const d = new Date(valeur);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/** Aujourd'hui (jour du serveur), au même format : une visite prévue avant cette date est passée. */
const aujourdhuiCalendaire = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

module.exports = { jourCalendaire, aujourdhuiCalendaire };
