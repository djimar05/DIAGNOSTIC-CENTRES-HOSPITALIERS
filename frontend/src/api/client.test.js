import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// localStorage minimal (les tests tournent sous Node)
const stockage = new Map();
vi.stubGlobal('localStorage', {
  getItem: (cle) => (stockage.has(cle) ? stockage.get(cle) : null),
  setItem: (cle, valeur) => stockage.set(cle, String(valeur)),
  removeItem: (cle) => stockage.delete(cle),
});

const json = (status, corps) => new Response(corps === undefined ? null : JSON.stringify(corps), {
  status, headers: { 'Content-Type': 'application/json' },
});

/** Faux backend : les access tokens valides sont listés dans `valides`, chaque refresh en émet un nouveau. */
const fauxBackend = ({ refreshAccepte = true } = {}) => {
  const etat = { valides: new Set(), rafraichissements: 0, appels: [] };
  const fetchMock = vi.fn(async (url, options = {}) => {
    const auth = options.headers?.Authorization;
    etat.appels.push({ url, auth });
    if (url.endsWith('/auth/rafraichir')) {
      etat.rafraichissements++;
      await new Promise((r) => setTimeout(r, 10)); // laisse le temps à d'autres requêtes de partir
      if (!refreshAccepte) return json(401, { success: false, error: { message: 'Session révoquée' } });
      const acces = `acces-${etat.rafraichissements}`;
      etat.valides.add(acces);
      return json(200, { success: true, data: { accessToken: acces, refreshToken: `refresh-${etat.rafraichissements}` } });
    }
    if (url.endsWith('/erreur')) {
      return json(400, { success: false, error: { message: 'Erreur de validation des données', details: ['nom requis'] } });
    }
    const token = auth?.replace('Bearer ', '');
    if (!etat.valides.has(token)) return json(401, { success: false, error: { message: 'Token expiré' } });
    return json(200, { success: true, data: { ok: true, token } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return etat;
};

let client;
let jetons;

beforeEach(async () => {
  stockage.clear();
  vi.resetModules(); // état du module (jeton en mémoire, refresh en cours) remis à zéro
  jetons = await import('./jetons');
  client = await import('./client');
});

afterEach(() => vi.restoreAllMocks());

describe('client API', () => {
  it('envoie le jeton dans l\'en-tête Authorization', async () => {
    const etat = fauxBackend();
    etat.valides.add('acces-initial');
    jetons.enregistrer({ accessToken: 'acces-initial', refreshToken: 'refresh-0' });

    const reponse = await client.api.get('/auth/moi');
    expect(reponse.data.token).toBe('acces-initial');
    expect(etat.appels[0].auth).toBe('Bearer acces-initial');
  });

  it('rafraîchit le jeton sur 401 puis rejoue la requête', async () => {
    const etat = fauxBackend();
    jetons.enregistrer({ accessToken: 'acces-expire', refreshToken: 'refresh-0' });

    const reponse = await client.api.get('/auth/moi');
    expect(reponse.data.token).toBe('acces-1');
    expect(etat.rafraichissements).toBe(1);
    expect(jetons.lireRefreshToken()).toBe('refresh-1');
  });

  it('un seul rafraîchissement pour plusieurs requêtes simultanées', async () => {
    const etat = fauxBackend();
    jetons.enregistrer({ accessToken: 'acces-expire', refreshToken: 'refresh-0' });

    const reponses = await Promise.all([client.api.get('/a'), client.api.get('/b'), client.api.get('/c')]);
    expect(reponses.every((r) => r.data.ok)).toBe(true);
    expect(etat.rafraichissements).toBe(1); // sinon le backend détecterait une réutilisation et couperait tout
  });

  it('page rechargée : redemande un access token avant la première requête', async () => {
    const etat = fauxBackend();
    localStorage.setItem('dch.refreshToken', 'refresh-0'); // pas d'access token en mémoire

    const reponse = await client.api.get('/auth/moi');
    expect(reponse.data.token).toBe('acces-1');
    expect(etat.appels.map((a) => a.url)).toEqual(['/api/auth/rafraichir', '/api/auth/moi']);
  });

  it('session refusée : efface les jetons et prévient l\'application', async () => {
    fauxBackend({ refreshAccepte: false });
    jetons.enregistrer({ accessToken: 'acces-expire', refreshToken: 'refresh-0' });
    const ecouteur = vi.fn();
    client.surDeconnexionForcee(ecouteur);

    await expect(client.api.get('/auth/moi')).rejects.toMatchObject({ status: 401 });
    expect(ecouteur).toHaveBeenCalledTimes(1);
    expect(jetons.lireRefreshToken()).toBeNull();
    expect(jetons.lireAccessToken()).toBeNull();
  });

  it('coupure réseau pendant le rafraîchissement : la session est conservée', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.endsWith('/auth/rafraichir')) throw new TypeError('Failed to fetch');
      return json(401, { success: false, error: { message: 'Token expiré' } });
    }));
    jetons.enregistrer({ accessToken: 'acces-expire', refreshToken: 'refresh-0' });
    const ecouteur = vi.fn();
    client.surDeconnexionForcee(ecouteur);

    await expect(client.api.get('/auth/moi')).rejects.toThrow('Failed to fetch');
    expect(ecouteur).not.toHaveBeenCalled();
    expect(jetons.lireRefreshToken()).toBe('refresh-0');
  });

  it('convertit les erreurs de l\'API en ErreurApi', async () => {
    const etat = fauxBackend();
    etat.valides.add('acces-initial');
    jetons.enregistrer({ accessToken: 'acces-initial', refreshToken: 'refresh-0' });

    const erreur = await client.api.post('/erreur', { nom: '' }).catch((e) => e);
    expect(erreur).toBeInstanceOf(client.ErreurApi);
    expect(erreur.status).toBe(400);
    expect(erreur.message).toBe('Erreur de validation des données');
    expect(erreur.details).toEqual(['nom requis']);
  });
});
