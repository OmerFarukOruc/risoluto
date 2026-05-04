import type { IconName } from "../../ui/icons.js";
import type { SettingsWorkbench } from "./workbench.js";

export interface SectionDef {
  id: string;
  label: string;
  group: string;
  icon: IconName;
}

export type SectionBuilder = (wb: SettingsWorkbench) => HTMLElement;
