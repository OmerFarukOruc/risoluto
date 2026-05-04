import "../styles/settings.css";

import { createSettingsPage } from "../features/settings/index.js";

export function render(): HTMLElement {
  return createSettingsPage();
}
