/**
 * Why a deductible attendance (PRESENT/LATE/ONLINE/OFFLINE) was NOT deducted
 * from a contract. Set once at first check-in alongside deductedContractId.
 *
 *   NO_ACTIVE_CONTRACT: subject resolved, but no ACTIVE contract found for it.
 *   NO_SUBJECT:         class/course chain broke, could not resolve a subject.
 */
export enum DeductionSkipReason {
  NO_ACTIVE_CONTRACT = 'NO_ACTIVE_CONTRACT',
  NO_SUBJECT = 'NO_SUBJECT',
}
