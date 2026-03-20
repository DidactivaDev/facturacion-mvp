import {
  AlertCircle,
  AlertTriangle,
  Info,
  type LucideIcon,
} from "lucide-react";
import type { AlertSeverity } from "./data-quality";

interface QualityAlertSeverityUi {
  label: string;
  emoji: string;
  bg: string;
  border: string;
  text: string;
  badge: string;
  icon: LucideIcon;
}

export const qualityAlertSeverityUi: Record<
  AlertSeverity,
  QualityAlertSeverityUi
> = {
  high: {
    label: "Alta",
    emoji: "🔴",
    bg: "bg-rose-500/10",
    border: "border-rose-200 dark:border-rose-800/40",
    text: "text-rose-700 dark:text-rose-400",
    badge:
      "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
    icon: AlertCircle,
  },
  medium: {
    label: "Media",
    emoji: "🟠",
    bg: "bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-800/40",
    text: "text-amber-700 dark:text-amber-400",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    icon: AlertTriangle,
  },
  low: {
    label: "Baja",
    emoji: "🔵",
    bg: "bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-800/40",
    text: "text-blue-700 dark:text-blue-400",
    badge:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    icon: Info,
  },
};
