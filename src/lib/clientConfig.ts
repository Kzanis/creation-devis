/**
 * Configuration client — charge les paramètres du client courant.
 *
 * En production, le client_id vient de l'URL (sous-domaine ou path).
 * En dev, on utilise le client "demo" par défaut.
 */

export interface ClientColors {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  accent: string;
  background: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  textMuted: string;
  danger: string;
  dangerLight: string;
  success: string;
  successLight: string;
}

export interface DossierFormat {
  prefix: string;       // ex: "FH", "LB", "" (vide = pas de préfixe)
  date_part: string;    // "YYYY" | "YYMM" | "YYYYMM" | "" (vide = pas de date)
  separator: string;    // "-" | "/" | ""
  padding: number;      // nombre de chiffres pour le compteur (3 = 001, 4 = 0001)
}

export interface ClientConfig {
  client_id: string;
  name: string;
  logo: string | null;
  colors: ClientColors;
  metier: string;
  airtable_base_id: string;
  api_token: string;
  n8n_base_url: string;
  dossier_format?: DossierFormat;
}

import demoConfig from "@/config/clients/demo.json";

const configs: Record<string, ClientConfig> = {
  demo: demoConfig as ClientConfig,
};

export function getClientConfig(clientId?: string): ClientConfig {
  const id = clientId || process.env.NEXT_PUBLIC_CLIENT_ID || "demo";
  return configs[id] || configs.demo;
}

export function getClientId(): string {
  return process.env.NEXT_PUBLIC_CLIENT_ID || "demo";
}
