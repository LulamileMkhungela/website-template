/** What a lead may show. The guessed mark is never returned to anyone but the family. */
export function leadMarkView(
  lead: { markGuess?: string | null; markCheck?: 'match' | 'no' | null },
  isOwner: boolean
): { guess: string | null; status: string } {
  if (!lead.markGuess && !lead.markCheck) return { guess: null, status: '' };
  if (isOwner) {
    return {
      guess: lead.markGuess?.trim() || null,
      status: lead.markCheck === 'match'
        ? 'This matches the mark only you know.'
        : lead.markCheck === 'no'
          ? 'This does not match.'
          : 'Check this against the mark only you know.'
    };
  }
  if (lead.markCheck === 'match') return { guess: null, status: 'The family checked this. The mark matched.' };
  if (lead.markCheck === 'no') return { guess: null, status: 'The family checked this. It did not match.' };
  if (lead.markGuess) return { guess: null, status: 'They named a mark. The family has not checked it.' };
  return { guess: null, status: '' };
}
