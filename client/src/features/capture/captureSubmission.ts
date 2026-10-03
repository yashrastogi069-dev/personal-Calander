import { newCaptureRequestId } from "./captureDraftStorage";

export type CaptureSubmissionIdentity = {
  requestId: string;
  lastSubmittedFingerprint: string | null;
  confirmedChangedFingerprint: string | null;
};

export function fingerprintCapturePayload(kind: string, payload: Record<string, unknown>) {
  return JSON.stringify({ kind, payload });
}

export function prepareCaptureSubmission(identity: CaptureSubmissionIdentity, fingerprint: string):
  | { needsConfirmation: true; identity: CaptureSubmissionIdentity }
  | { needsConfirmation: false; identity: CaptureSubmissionIdentity } {
  if (identity.lastSubmittedFingerprint && identity.lastSubmittedFingerprint !== fingerprint && identity.confirmedChangedFingerprint !== fingerprint) {
    return { needsConfirmation: true, identity: { ...identity, confirmedChangedFingerprint: fingerprint } };
  }
  const requestId = identity.lastSubmittedFingerprint === fingerprint ? identity.requestId :
    identity.lastSubmittedFingerprint ? newCaptureRequestId() : identity.requestId;
  return { needsConfirmation: false, identity: { requestId, lastSubmittedFingerprint: fingerprint, confirmedChangedFingerprint: null } };
}

export function captureCanUseResult(mounted: boolean, activeSubmission: number | null, submittedToken: number, currentScope: string | null, submittedScope: string | null) {
  return mounted && activeSubmission === submittedToken && currentScope === submittedScope;
}
