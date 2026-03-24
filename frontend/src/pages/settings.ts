import "../styles/settings.css";
import "../styles/config.css";
import "../styles/secrets.css";
import "../styles/unified-settings.css";

import { createUnifiedSettingsPage } from "../views/unified-settings-view";

export function render(): HTMLElement {
  return createUnifiedSettingsPage();
}
