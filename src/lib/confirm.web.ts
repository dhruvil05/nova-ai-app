// React Native's Alert does nothing on web, so the dev preview uses the browser dialog.
export function confirm(title: string, message: string): Promise<boolean> {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}
