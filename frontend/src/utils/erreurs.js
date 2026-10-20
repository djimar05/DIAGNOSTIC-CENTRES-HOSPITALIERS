import { notifications } from '@mantine/notifications';

/** Message lisible pour une erreur de l'API (ErreurApi) ou une coupure réseau. */
export const messageErreur = (err) => {
  if (!err) return '';
  if (!err.status) return 'Serveur injoignable. Vérifiez votre connexion internet.';
  return err.details?.length ? `${err.message} : ${err.details.join(', ')}` : err.message;
};

export const notifierErreur = (err, titre = 'Action impossible') => {
  notifications.show({ color: 'red', title: titre, message: messageErreur(err) });
};

export const notifierSucces = (message) => {
  notifications.show({ color: 'teal', message });
};
