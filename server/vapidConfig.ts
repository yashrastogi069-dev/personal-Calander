export type VapidConfiguration = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

const BASE64_URL = /^[A-Za-z0-9_-]+$/;

export function validateVapidConfiguration(configuration: VapidConfiguration): {
  valid: boolean;
  reason?: string;
} {
  if (!configuration.publicKey || !BASE64_URL.test(configuration.publicKey)) {
    return { valid: false, reason: "The VAPID public key must be a base64url value." };
  }

  if (!configuration.privateKey || !BASE64_URL.test(configuration.privateKey)) {
    return { valid: false, reason: "The VAPID private key must be a base64url value." };
  }

  if (!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(configuration.subject) && !/^https:\/\/[^\s]+$/i.test(configuration.subject)) {
    return { valid: false, reason: "The VAPID subject must be a mailto: or HTTPS contact URI." };
  }

  return { valid: true };
}

export function getVapidConfigurationFromEnvironment(environment = process.env): VapidConfiguration {
  return {
    publicKey: environment.VITE_VAPID_PUBLIC_KEY ?? "",
    privateKey: environment.VAPID_PRIVATE_KEY ?? "",
    subject: environment.VAPID_SUBJECT ?? "",
  };
}
