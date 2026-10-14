import { useState } from 'react'
import { errorMessage } from '@/lib/errors'
import { detectRendererPlatform } from '@/lib/platform-shortcuts'
import { Modal } from '@/components/ui'
import type { AppMeta, AppSettings, PrimeModelCatalog, PrimeWorkApi } from '@/types/api'
import { AboutSettings } from './settings/AboutSettings'
import { AgentSettings } from './settings/AgentSettings'
import { AppearanceSettings } from './settings/AppearanceSettings'
import { BrowserSettings } from './settings/BrowserSettings'
import type { SettingsSection, SettingsUpdate } from './settings/contracts'
import { GeneralSettings } from './settings/GeneralSettings'
import { PrivacySettings } from './settings/PrivacySettings'
import { PetsSettings } from './settings/PetsSettings'
import { ProvidersSettings } from './settings/ProviderSettings'
import { TerminalSettings } from './settings/TerminalSettings'
import { VoiceSettings } from './settings/VoiceSettings'

interface SettingsPageProps {
  settings: AppSettings
  meta?: AppMeta | null
  providerCatalog: PrimeModelCatalog | null
  voice: PrimeWorkApi['voice'] | null
  pets: PrimeWorkApi['pets'] | null
  /** Active section; the sidebar owns settings navigation while this view is open. */
  section: SettingsSection
  onUpdate: SettingsUpdate
  onResetBrowser(): Promise<void> | void
  onOpenDocs(): void
  onRefreshProviders(): Promise<void>
  onRefreshHarnesses(): Promise<void>
  onSetProviderEnabled(providerId: string, enabled: boolean): Promise<void>
  onSetAllProvidersEnabled(): Promise<void>
  onSetAllProvidersDisabled(): Promise<void>
  onSetModelEnabled(modelKey: string, enabled: boolean): Promise<void>
}

export function SettingsPage({ settings, meta, providerCatalog, voice, pets, section, onUpdate, onResetBrowser, onOpenDocs, onRefreshProviders, onRefreshHarnesses, onSetProviderEnabled, onSetAllProvidersEnabled, onSetAllProvidersDisabled, onSetModelEnabled }: SettingsPageProps) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')
  const platform = meta?.platform ?? detectRendererPlatform()

  const resetBrowser = async () => {
    setResetting(true)
    setResetError('')
    try {
      await onResetBrowser()
      setConfirmReset(false)
    } catch (error) {
      setResetError(errorMessage(error))
    } finally {
      setResetting(false)
    }
  }

  const content = (() => {
    switch (section) {
      case 'general': return <GeneralSettings settings={settings} onUpdate={onUpdate} platform={platform} />
      case 'appearance': return <AppearanceSettings settings={settings} onUpdate={onUpdate} />
      case 'agent': return <AgentSettings settings={settings} meta={meta} onUpdate={onUpdate} onRefreshHarnesses={onRefreshHarnesses} />
      case 'providers': return <ProvidersSettings harness={settings.activeHarness} catalog={providerCatalog} onRefresh={onRefreshProviders} onSetEnabled={onSetProviderEnabled} onSetAllEnabled={onSetAllProvidersEnabled} onSetAllDisabled={onSetAllProvidersDisabled} onSetModelEnabled={onSetModelEnabled} onOpenDocs={onOpenDocs} />
      case 'voice': return <VoiceSettings settings={settings} onUpdate={onUpdate} voice={voice} platform={platform} />
      case 'pets': return <PetsSettings settings={settings} onUpdate={onUpdate} pets={pets} />
      case 'browser': return <BrowserSettings settings={settings} onUpdate={onUpdate} onRequestReset={() => { setResetError(''); setConfirmReset(true) }} />
      case 'terminal': return <TerminalSettings settings={settings} onUpdate={onUpdate} platform={platform} />
      case 'privacy': return <PrivacySettings settings={settings} onUpdate={onUpdate} />
      case 'about': return <AboutSettings meta={meta} onOpenDocs={onOpenDocs} />
    }
  })()

  return (
    <div className="settings-page">
      <div className="settings-content scroll-area"><div className="settings-content__inner">{content}</div></div>
      {confirmReset ? (
        <Modal
          title="Clear browser data?"
          onClose={() => { if (!resetting) setConfirmReset(false) }}
          footer={(
            <>
              <button type="button" className="button" disabled={resetting} onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" className="button button--danger" disabled={resetting} onClick={() => { void resetBrowser() }}>{resetting ? 'Clearing…' : 'Clear browsing data'}</button>
            </>
          )}
        >
          <p>This signs you out of websites opened in Catfish-Pi and removes history, cache, cookies, and saved permissions. This cannot be undone.</p>
          {resetError ? <p className="settings-error" role="alert">{resetError}</p> : null}
        </Modal>
      ) : null}
    </div>
  )
}
