/**
 * SaveLoadPanel — Save/Load overlay panel with Soviet terminal styling.
 *
 * Provides autosave status, 5 named save slots, manual save with custom
 * name input, and status feedback for save/load/delete operations.
 * Accessible from the STATE tab or pause menu.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

export interface SaveLoadPanelProps {
  visible: boolean;
  onDismiss: () => void;
  onSave?: (name: string) => Promise<boolean>;
  onLoad?: (name: string) => Promise<boolean>;
  onDelete?: (name: string) => Promise<void>;
  onCheckSave?: (name: string) => Promise<boolean>;
  onExport?: () => string | null;
  onImport?: (json: string) => boolean;
  saveNames?: string[];
  autoSaveEnabled?: boolean;
  lastSaveTime?: number;
}

const SLOT_NAMES = ['save_1', 'save_2', 'save_3', 'save_4', 'save_5'] as const;

/** Returns a human-readable relative time string from a timestamp. */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const delta = Math.max(0, now - timestamp);
  const seconds = Math.floor(delta / 1000);

  if (seconds < 60) return `${seconds} SECONDS AGO`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} MINUTE${minutes !== 1 ? 'S' : ''} AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} HOUR${hours !== 1 ? 'S' : ''} AGO`;
  const days = Math.floor(hours / 24);
  return `${days} DAY${days !== 1 ? 'S' : ''} AGO`;
}

export const SaveLoadPanel: React.FC<SaveLoadPanelProps> = ({
  visible,
  onDismiss,
  onSave,
  onLoad,
  onDelete,
  onExport,
  onImport,
  saveNames = [],
  autoSaveEnabled = false,
  lastSaveTime,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');
  const [busy, setBusy] = useState(false);
  const [customName, setCustomName] = useState('');
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const occupiedSlots = new Set(saveNames);

  // Clear status timer on unmount or when panel hides
  useEffect(() => {
    if (!visible) {
      setStatusMessage(null);
      setCustomName('');
    }
    return () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, [visible]);

  const showStatus = useCallback((message: string, type: 'success' | 'error') => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatusMessage(message);
    setStatusType(type);
    statusTimer.current = setTimeout(() => {
      setStatusMessage(null);
      statusTimer.current = null;
    }, 3000);
  }, []);

  const handleSave = useCallback(async (slotName: string) => {
    if (!onSave || busy) return;
    setBusy(true);
    try {
      const ok = await onSave(slotName);
      showStatus(
        ok ? `SAVE SUCCESSFUL: ${slotName.toUpperCase()}` : `SAVE FAILED: ${slotName.toUpperCase()}`,
        ok ? 'success' : 'error',
      );
    } catch {
      showStatus(`SAVE ERROR: ${slotName.toUpperCase()}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [onSave, busy, showStatus]);

  const handleLoad = useCallback(async (slotName: string) => {
    if (!onLoad || busy) return;
    setBusy(true);
    try {
      const ok = await onLoad(slotName);
      showStatus(
        ok ? `LOADED: ${slotName.toUpperCase()}` : `LOAD FAILED: ${slotName.toUpperCase()}`,
        ok ? 'success' : 'error',
      );
    } catch {
      showStatus(`LOAD ERROR: ${slotName.toUpperCase()}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [onLoad, busy, showStatus]);

  const handleDelete = useCallback(async (slotName: string) => {
    if (!onDelete || busy) return;
    setBusy(true);
    try {
      await onDelete(slotName);
      showStatus(`DELETED: ${slotName.toUpperCase()}`, 'success');
    } catch {
      showStatus(`DELETE ERROR: ${slotName.toUpperCase()}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [onDelete, busy, showStatus]);

  const handleCustomSave = useCallback(() => {
    const trimmed = customName.trim().replace(/[^a-zA-Z0-9_\- ]/g, '');
    if (!trimmed) {
      showStatus('ENTER A SAVE NAME, COMRADE', 'error');
      return;
    }
    const reserved = new Set(['autosave', ...SLOT_NAMES]);
    if (reserved.has(trimmed.toLowerCase())) {
      showStatus('NAME RESERVED BY THE STATE', 'error');
      return;
    }
    handleSave(trimmed);
    setCustomName('');
  }, [customName, handleSave, showStatus]);

  const handleExport = useCallback(() => {
    if (!onExport || busy) return;
    setBusy(true);
    try {
      const json = onExport();
      if (!json) {
        showStatus('EXPORT FAILED — NO STATE DATA AVAILABLE', 'error');
        setBusy(false);
        return;
      }

      // Extract city name and year from save data for filename
      let cityName = 'settlement';
      let year = 1922;
      try {
        const parsed = JSON.parse(json);
        if (parsed.gameConfig?.cityName) {
          cityName = parsed.gameConfig.cityName.replace(/[^a-zA-Z0-9]/g, '-');
        }
        if (parsed.gameMeta?.date?.year) {
          year = parsed.gameMeta.date.year;
        }
      } catch {
        // Use defaults
      }

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `simSoviet-${cityName}-${year}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      showStatus('STATE ARCHIVE EXPORTED SUCCESSFULLY', 'success');
    } catch {
      showStatus('EXPORT ERROR — ARCHIVE CREATION FAILED', 'error');
    } finally {
      setBusy(false);
    }
  }, [onExport, busy, showStatus]);

  const handleImport = useCallback(() => {
    if (!onImport || busy) return;

    // Create a hidden file input and trigger it
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      setBusy(true);
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const json = evt.target?.result as string;
          if (!json) {
            showStatus('DOCUMENT REJECTED. FILE IS EMPTY.', 'error');
            setBusy(false);
            return;
          }

          // Validate JSON parses
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(json);
          } catch {
            showStatus('DOCUMENT REJECTED. FORMAT INCOMPATIBLE WITH STATE ARCHIVES.', 'error');
            setBusy(false);
            return;
          }

          // Validate expected top-level keys
          if (
            !parsed.version ||
            !parsed.resources ||
            !parsed.gameMeta ||
            !Array.isArray(parsed.buildings)
          ) {
            showStatus('DOCUMENT REJECTED. MISSING REQUIRED STATE RECORDS.', 'error');
            setBusy(false);
            return;
          }

          const ok = onImport(json);
          showStatus(
            ok
              ? `STATE ARCHIVE IMPORTED: ${file.name}`
              : 'IMPORT FAILED. ARCHIVE DATA CORRUPTED.',
            ok ? 'success' : 'error',
          );
        } catch {
          showStatus('IMPORT ERROR. DOCUMENT PROCESSING FAILED.', 'error');
        } finally {
          setBusy(false);
        }
      };
      reader.onerror = () => {
        showStatus('FILE READ ERROR. DOCUMENT INACCESSIBLE.', 'error');
        setBusy(false);
      };
      reader.readAsText(file);

      // Clean up
      document.body.removeChild(input);
    };

    document.body.appendChild(input);
    input.click();
  }, [onImport, busy, showStatus]);

  if (!visible) return null;

  const hasAutosave = occupiedSlots.has('autosave');

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="STATE ARCHIVES"
      stampText="CLASSIFIED"
      actionLabel="CLOSE"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* ---- SECTION 1: AUTOSAVE STATUS ---- */}
      <Text style={styles.sectionHeader}>AUTOSAVE STATUS</Text>
      <View style={styles.autosaveRow}>
        <View style={styles.autosaveInfo}>
          <View style={[styles.badge, autoSaveEnabled ? styles.badgeEnabled : styles.badgeDisabled]}>
            <Text style={styles.badgeText}>
              {autoSaveEnabled ? 'ENABLED' : 'DISABLED'}
            </Text>
          </View>
          {lastSaveTime != null && (
            <Text style={styles.lastSaveText}>
              LAST SAVE: {formatRelativeTime(lastSaveTime)}
            </Text>
          )}
          {lastSaveTime == null && (
            <Text style={styles.lastSaveTextMuted}>NO SAVES RECORDED</Text>
          )}
        </View>
        <View style={styles.autosaveActions}>
          <TouchableOpacity
            style={[styles.slotBtn, styles.saveBtn]}
            onPress={() => handleSave('autosave')}
            disabled={busy || !onSave}
            activeOpacity={0.7}
          >
            <Text style={styles.slotBtnText}>QUICK SAVE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.slotBtn, styles.loadBtn, !hasAutosave && styles.slotBtnDisabled]}
            onPress={() => handleLoad('autosave')}
            disabled={busy || !hasAutosave || !onLoad}
            activeOpacity={0.7}
          >
            <Text style={[styles.slotBtnText, !hasAutosave && styles.slotBtnTextDisabled]}>
              QUICK LOAD
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ---- SECTION 2: SAVE SLOTS ---- */}
      <Text style={styles.sectionHeader}>SAVE SLOTS</Text>
      {SLOT_NAMES.map((slot, index) => {
        const isOccupied = occupiedSlots.has(slot);
        return (
          <View key={slot} style={styles.slotRow}>
            <View style={styles.slotInfo}>
              <Text style={styles.slotNumber}>#{index + 1}</Text>
              <Text style={[styles.slotStatus, isOccupied ? styles.slotOccupied : styles.slotEmpty]}>
                {isOccupied ? slot.toUpperCase() : 'EMPTY'}
              </Text>
            </View>
            <View style={styles.slotActions}>
              <TouchableOpacity
                style={[styles.slotBtn, styles.saveBtn]}
                onPress={() => handleSave(slot)}
                disabled={busy || !onSave}
                activeOpacity={0.7}
              >
                <Text style={styles.slotBtnText}>SAVE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.slotBtn, styles.loadBtn, !isOccupied && styles.slotBtnDisabled]}
                onPress={() => handleLoad(slot)}
                disabled={busy || !isOccupied || !onLoad}
                activeOpacity={0.7}
              >
                <Text style={[styles.slotBtnText, !isOccupied && styles.slotBtnTextDisabled]}>
                  LOAD
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, !isOccupied && styles.slotBtnDisabled]}
                onPress={() => handleDelete(slot)}
                disabled={busy || !isOccupied || !onDelete}
                activeOpacity={0.7}
              >
                <Text style={[styles.deleteBtnText, !isOccupied && styles.slotBtnTextDisabled]}>
                  X
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <View style={styles.divider} />

      {/* ---- MANUAL SAVE ---- */}
      <Text style={styles.sectionHeader}>MANUAL SAVE</Text>
      <View style={styles.customSaveRow}>
        <TextInput
          style={styles.customInput}
          value={customName}
          onChangeText={setCustomName}
          placeholder="ENTER SAVE NAME..."
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
          maxLength={32}
        />
        <TouchableOpacity
          style={[styles.slotBtn, styles.saveBtn]}
          onPress={handleCustomSave}
          disabled={busy || !onSave}
          activeOpacity={0.7}
        >
          <Text style={styles.slotBtnText}>SAVE</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* ---- SECTION: FILE I/O ---- */}
      <Text style={styles.sectionHeader}>STATE ARCHIVE — CLASSIFIED</Text>
      <Text style={styles.fileIoNote}>
        EXPORT / IMPORT GAME STATE AS JSON DOCUMENT
      </Text>
      <View style={styles.fileIoRow}>
        <TouchableOpacity
          style={[styles.fileIoBtn, styles.exportBtn]}
          onPress={handleExport}
          disabled={busy || !onExport}
          activeOpacity={0.7}
        >
          <Text style={styles.fileIoBtnText}>EXPORT SAVE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fileIoBtn, styles.importBtn]}
          onPress={handleImport}
          disabled={busy || !onImport}
          activeOpacity={0.7}
        >
          <Text style={styles.fileIoBtnText}>IMPORT SAVE</Text>
        </TouchableOpacity>
      </View>

      {/* ---- SECTION 3: STATUS MESSAGE ---- */}
      {statusMessage != null && (
        <View
          style={[
            styles.statusBar,
            statusType === 'success' ? styles.statusSuccess : styles.statusError,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: statusType === 'success' ? Colors.termGreen : Colors.sovietRed },
            ]}
          >
            {statusMessage}
          </Text>
        </View>
      )}
    </SovietModal>
  );
};

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    marginBottom: 8,
    marginTop: 4,
  },

  // ---- Autosave section ----
  autosaveRow: {
    marginBottom: 8,
  },
  autosaveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  badgeEnabled: {
    borderColor: Colors.termGreen,
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
  },
  badgeDisabled: {
    borderColor: Colors.textMuted,
    backgroundColor: 'rgba(136, 136, 136, 0.1)',
  },
  badgeText: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  lastSaveText: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
  },
  lastSaveTextMuted: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textMuted,
  },
  autosaveActions: {
    flexDirection: 'row',
    gap: 8,
  },

  // ---- Divider ----
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 12,
  },

  // ---- Slot rows ----
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
  },
  slotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotNumber: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termBlue,
    width: 24,
  },
  slotStatus: {
    fontSize: 11,
    fontFamily: monoFont,
  },
  slotOccupied: {
    color: Colors.textPrimary,
  },
  slotEmpty: {
    color: Colors.textMuted,
  },
  slotActions: {
    flexDirection: 'row',
    gap: 6,
  },

  // ---- Buttons ----
  slotBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderColor: Colors.termGreen,
  },
  loadBtn: {
    backgroundColor: 'rgba(251, 192, 45, 0.15)',
    borderColor: Colors.sovietGold,
  },
  slotBtnDisabled: {
    backgroundColor: 'rgba(136, 136, 136, 0.05)',
    borderColor: '#333',
  },
  slotBtnText: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  slotBtnTextDisabled: {
    color: '#444',
  },
  deleteBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.sovietRed,
    backgroundColor: 'rgba(198, 40, 40, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
  },

  // ---- Custom save ----
  customSaveRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  customInput: {
    flex: 1,
    height: 32,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 8,
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },

  // ---- File I/O section ----
  fileIoNote: {
    fontSize: 9,
    fontFamily: monoFont,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
  },
  fileIoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  fileIoBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtn: {
    backgroundColor: 'rgba(198, 40, 40, 0.2)',
    borderColor: Colors.sovietRed,
  },
  importBtn: {
    backgroundColor: 'rgba(251, 192, 45, 0.2)',
    borderColor: Colors.sovietGold,
  },
  fileIoBtnText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 2,
  },

  // ---- Status bar ----
  statusBar: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusSuccess: {
    borderColor: Colors.termGreen,
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
  },
  statusError: {
    borderColor: Colors.sovietRed,
    backgroundColor: 'rgba(198, 40, 40, 0.08)',
  },
  statusText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
