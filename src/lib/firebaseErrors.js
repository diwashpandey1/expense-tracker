export function explainFirebaseError(error, subject = 'Your data') {
  if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') {
    return `Firebase denied access to ${subject}. Confirm Firestore is enabled and deploy this project's firestore.rules file.`
  }
  if (error?.code === 'failed-precondition') {
    return `Firestore could not run the ${subject} query. Deploy this project's firestore.indexes.json and retry.`
  }
  if (error?.code === 'unavailable' || error?.code === 'network-request-failed') {
    return `Firebase is temporarily unreachable, so ${subject} could not be loaded. Check your connection and retry.`
  }
  return `${subject} could not be loaded. Check the Firebase configuration and retry.`
}
