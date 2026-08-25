import { describe, expect, it } from "vitest";
import { getVapidConfigurationFromEnvironment, validateVapidConfiguration } from "./vapidConfig";

describe("VAPID configuration", () => {
  it("accepts the securely supplied environment configuration without exposing its private key", () => {
    const result = validateVapidConfiguration(getVapidConfigurationFromEnvironment());

    expect(result).toEqual({ valid: true });
  });

  it("rejects an invalid contact subject before notification behavior can be enabled", () => {
    const result = validateVapidConfiguration({
      publicKey: "valid_public_key",
      privateKey: "valid_private_key",
      subject: "person@example.com",
    });

    expect(result).toEqual({ valid: false, reason: "The VAPID subject must be a mailto: or HTTPS contact URI." });
  });
});
