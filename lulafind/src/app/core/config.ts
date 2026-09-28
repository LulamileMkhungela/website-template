/**
 * One place for the details that are easy to get wrong and hard to find later.
 * Change these first when you go live - nothing else in the app hard-codes them.
 */

/** Support inbox shown in Settings, the sign-up screen and the terms. */
export const SUPPORT_EMAIL = 'mkhungela.l@gmail.com';

/** Name shown next to the support inbox. */
export const SUPPORT_NAME = 'Lulamile at LulaFind';

/** Base URL used by every Share button and deep link. Change to your real domain. */
export const BASE_URL = 'https://lulafind.co.za';

/**
 * Mock mode has no mail server, so the sign-up screen also shows the code.
 * This flag is the only dummy. Verification does not read it: the code the
 * person types is checked against the one that was stored when it was sent.
 * Set this to false to hide the on-screen code. Sign-up keeps working.
 */
export const SHOW_DEMO_OTP = true;
