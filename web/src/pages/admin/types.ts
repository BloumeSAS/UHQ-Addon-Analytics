export interface PageProps {
  /** Fenêtre d'analyse (jours). */
  days: number;
  /** Incrémenté par le bouton « Actualiser » : force un rechargement sans cache. */
  nonce: number;
}
