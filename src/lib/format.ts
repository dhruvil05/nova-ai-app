/** A short date for lists: the time for today, otherwise the day and month (and year if not this year). */
export function formatDate(ms: number) {
  const date = new Date(ms);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}
