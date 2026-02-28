/**
 * SettingsModal — Game settings panel.
 *
 * Toggles for music, color-blind mode. Accessible from MainMenu
 * SETTINGS button and in-game pause.
 */

import type React from 'react';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AudioManager from '../audio/AudioManager';
import SFXManager from '../audio/SFXManager';
import { isColorBlindMode, setColorBlindMode } from '../stores/gameStore';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

export interface SettingsModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onDismiss }) => {
  const [muted, setMuted] = useState(() => AudioManager.getInstance().isMuted);
  const [sfxMuted, setSfxMuted] = useState(() => SFXManager.getInstance().isMuted);
  const [colorBlind, setColorBlind] = useState(() => isColorBlindMode());

  const handleToggleMusic = () => {
    const newMuted = AudioManager.getInstance().toggleMute();
    setMuted(newMuted);
  };

  const handleToggleSFX = () => {
    const newMuted = SFXManager.getInstance().toggleMute();
    setSfxMuted(newMuted);
  };

  const handleToggleColorBlind = () => {
    const newValue = !colorBlind;
    setColorBlindMode(newValue);
    setColorBlind(newValue);
  };

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="SETTINGS"
      stampText="CONFIG"
      actionLabel="CLOSE"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      <Text style={styles.subtitle}>CENTRAL CONFIGURATION BUREAU</Text>

      <SettingToggle
        label="MUSIC"
        description={muted ? 'The orchestra is silent.' : 'Soviet anthems fill the air.'}
        value={!muted}
        onToggle={handleToggleMusic}
      />

      <SettingToggle
        label="SOUND EFFECTS"
        description={sfxMuted ? 'The factory floor is silent.' : 'Industrial sounds of progress.'}
        value={!sfxMuted}
        onToggle={handleToggleSFX}
      />

      <SettingToggle
        label="COLOR-BLIND MODE"
        description={colorBlind ? 'Patterns supplement colors.' : 'Standard color display.'}
        value={colorBlind}
        onToggle={handleToggleColorBlind}
      />

      <View style={styles.divider} />
      <Text style={styles.footer}>SETTINGS ARE SAVED AUTOMATICALLY /// THE STATE REMEMBERS</Text>
    </SovietModal>
  );
};

interface SettingToggleProps {
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}

const SettingToggle: React.FC<SettingToggleProps> = ({ label, description, value, onToggle }) => (
  <View style={styles.settingRow}>
    <View style={styles.settingInfo}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingDesc}>{description}</Text>
    </View>
    <TouchableOpacity
      onPress={onToggle}
      style={[styles.toggleBtn, value && styles.toggleBtnActive]}
      activeOpacity={0.7}
    >
      <Text style={[styles.toggleText, value && styles.toggleTextActive]}>{value ? 'ON' : 'OFF'}</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#666',
    letterSpacing: 2,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 13,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
  },
  settingDesc: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#888',
    marginTop: 2,
  },
  toggleBtn: {
    width: 60,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    borderWidth: 2,
    borderTopColor: '#555',
    borderLeftColor: '#555',
    borderBottomColor: '#111',
    borderRightColor: '#111',
  },
  toggleBtnActive: {
    backgroundColor: Colors.sovietRed,
    borderTopColor: '#ff8a80',
    borderLeftColor: '#ff8a80',
    borderBottomColor: Colors.sovietDarkRed,
    borderRightColor: Colors.sovietDarkRed,
  },
  toggleText: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#666',
    letterSpacing: 2,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  footer: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#555',
    letterSpacing: 1,
    textAlign: 'center',
  },
});
