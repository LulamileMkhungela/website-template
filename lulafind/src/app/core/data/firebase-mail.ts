import { environment } from '../../../environments/environment';

/**
 * Firebase email-link auth stub.
 *
 * Returns true when Firebase is configured AND the product wants to use
 * Firebase email-link verification instead of the in-app 6-digit OTP flow.
 * Set environment.firebaseMail = true to enable once the Firebase project
 * is wired up.
 */
export function firebaseMailEnabled(): boolean {
  return (environment as any).firebaseMail === true;
}
