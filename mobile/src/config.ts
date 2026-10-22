import Constants from 'expo-constants';

/**
 * Adresse de l'API vue par le téléphone.
 *   1. EXPO_PUBLIC_API_URL si elle est définie (fichier .env) ;
 *   2. sinon, en développement : le PC qui fait tourner Metro (hostUri = "192.168.1.20:8081"), port 3000.
 *      Sur un téléphone, « localhost » désignerait le téléphone lui-même, pas le PC.
 */
const hoteMetro = Constants.expoConfig?.hostUri?.split(':')[0];

export const API_URL = process.env.EXPO_PUBLIC_API_URL
  || (hoteMetro ? `http://${hoteMetro}:3000/api` : 'http://localhost:3000/api');
