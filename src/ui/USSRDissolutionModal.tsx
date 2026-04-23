/**
 * USSRDissolutionModal — shown when historical mode reaches year 1991.
 *
 * Offers two paths:
 *   - End Assignment: closes the historical campaign record
 *   - Continue: keeps managing the same grounded settlement after 1991
 *
 * Pure component. All decisions flow through onResolve.
 */

import type React from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, monoFont } from './styles';

export interface USSRDissolutionModalProps {
  visible: boolean;
  onResolve: (continueInPostCampaign: boolean) => void;
}

export const USSRDissolutionModal: React.FC<USSRDissolutionModalProps> = ({ visible, onResolve }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.backdrop}>
      <View style={styles.document}>
        <View style={styles.headerRow}>
          <Text style={styles.divisionLabel}>CENTRAL COMMITTEE — EYES ONLY</Text>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>1991</Text>
          </View>
        </View>

        <Text style={styles.title}>THE UNION HAS DISSOLVED</Text>
        <Text style={styles.headline}>
          {
            '\u041D\u0430 74-\u043C \u0433\u043E\u0434\u0443 \u0421\u043E\u0432\u0435\u0442\u0441\u043A\u043E\u0439 \u0432\u043B\u0430\u0441\u0442\u0438 \u0421\u043E\u044E\u0437 \u0421\u043E\u0432\u0435\u0442\u0441\u043A\u0438\u0445 \u0421\u043E\u0446\u0438\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0420\u0435\u0441\u043F\u0443\u0431\u043B\u0438\u043A \u043F\u0440\u0435\u043A\u0440\u0430\u0442\u0438\u043B \u0441\u0432\u043E\u0451 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u0435.'
          }
        </Text>
        <View style={styles.divider} />

        <Text style={styles.body}>
          The August coup has failed. The Baltic states have declared independence. Yeltsin stands on a tank. Gorbachev
          resigns on Christmas Day.
          {'\n\n'}
          Seventy-four years of your assignment — from the revolution to this moment — are on the record. The file can
          be closed here.
          {'\n\n'}
          Or: keep the same settlement running after the campaign record closes. No new epoch begins. There are still
          shortages, pipes, quotas, and people who expect heat in winter.
        </Text>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.btn, styles.btnContinue]} onPress={() => onResolve(true)} activeOpacity={0.8}>
          <Text style={styles.btnLabel}>CONTINUE FREE PLAY</Text>
          <Text style={styles.btnSub}>Keep managing the same grounded settlement.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.btnEnd]} onPress={() => onResolve(false)} activeOpacity={0.8}>
          <Text style={styles.btnLabel}>END ASSIGNMENT</Text>
          <Text style={styles.btnSub}>Close the file. See your historical record.</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  document: {
    width: '90%',
    maxWidth: 620,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: Colors.sovietRed,
    padding: 24,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 20px rgba(198, 40, 40, 0.5)' }
      : {
          shadowColor: Colors.sovietRed,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
        }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  divisionLabel: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  stamp: {
    borderWidth: 2,
    borderColor: Colors.sovietRed,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '-3deg' }],
  },
  stampText: {
    fontFamily: monoFont,
    fontSize: 18,
    color: Colors.sovietRed,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  title: {
    fontFamily: monoFont,
    fontSize: 18,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  headline: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 10,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.panelShadow,
    marginVertical: 12,
  },
  body: {
    fontFamily: monoFont,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  btn: {
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
  },
  btnContinue: {
    borderColor: Colors.termGreen,
    backgroundColor: 'rgba(0,230,118,0.05)',
  },
  btnEnd: {
    borderColor: Colors.textMuted,
    backgroundColor: 'transparent',
  },
  btnLabel: {
    fontFamily: monoFont,
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  btnSub: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 3,
  },
});
