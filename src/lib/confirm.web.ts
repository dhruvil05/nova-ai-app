import { askToConfirm } from '@/components/ConfirmDialog';

// window.confirm is blocked in embedded browsers (it returns false without
// showing anything), so the web build asks with a dialog drawn by the app.
export function confirm(title: string, message: string, confirmLabel = 'Delete'): Promise<boolean> {
  return askToConfirm(title, message, confirmLabel);
}
