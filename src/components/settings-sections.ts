import { AudioLines, Bot, Boxes, Info, LockKeyhole, PawPrint, Settings2, Sun, Terminal, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import type { MessageKey } from '@/lib/i18n'
import type { SettingsSection } from '@/pages/settings/contracts'
import { BrowserGlobe } from './ui'

/** Settings sections rendered as the sidebar's contextual navigation while the settings view is active. */
export const SETTINGS_SECTIONS: Array<{ id: SettingsSection; label: MessageKey; icon: ComponentType<{ size?: number }> | LucideIcon }> = [
  { id: 'general', label: 'settings.general', icon: Settings2 },
  { id: 'appearance', label: 'settings.appearance', icon: Sun },
  { id: 'agent', label: 'settings.harness', icon: Bot },
  { id: 'providers', label: 'settings.providers', icon: Boxes },
  { id: 'voice', label: 'settings.voice', icon: AudioLines },
  { id: 'pets', label: 'settings.pets', icon: PawPrint },
  { id: 'browser', label: 'settings.browser', icon: BrowserGlobe },
  { id: 'terminal', label: 'settings.terminal', icon: Terminal },
  { id: 'privacy', label: 'settings.privacy', icon: LockKeyhole },
  { id: 'about', label: 'settings.about', icon: Info },
]
