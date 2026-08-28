import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { getDatabase } from '../db/database';
import CryptoJS from 'crypto-js';
import { uploadData, downloadData } from 'aws-amplify/storage';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const PIN_KEY = 'VAULT_MASTER_PIN';

export default function SyncScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('Ready to sync');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // NEW: State to track if the device already knows the PIN
  const [hasSavedPin, setHasSavedPin] = useState(false);

  useEffect(() => {
    checkSession();
    checkForSavedPin();
  }, []);

  const checkSession = async () => {
    try {
      const user = await getCurrentUser();
      setUserEmail(user.signInDetails?.loginId || user.username);
    } catch {
      router.replace('/auth');
    }
  };

  // --- Hardware Security Checks ---
  const checkForSavedPin = async () => {
    const savedPin = await SecureStore.getItemAsync(PIN_KEY);
    if (savedPin) {
      setHasSavedPin(true);
    }
  };

  const clearSavedPin = async () => {
    await SecureStore.deleteItemAsync(PIN_KEY);
    setHasSavedPin(false);
    setPin('');
    Alert.alert("Hardware Key Cleared", "You will need to manually enter your PIN next time.");
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      Alert.alert("Signed Out", "You have securely disconnected from the vault.");
      router.replace('/');
    } catch (error: any) {
      Alert.alert("Error signing out", error.message);
    }
  };

  // --- Core Action Wrapper (Handles Biometrics vs Manual) ---
  const executeVaultAction = async (actionType: 'backup' | 'restore') => {
    let activePin = pin;

    // 1. If they have a saved PIN, force biometric authentication
    if (hasSavedPin) {
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: actionType === 'backup' ? 'Unlock to Backup Data' : 'Unlock to Restore Data',
        fallbackLabel: 'Use Device Passcode'
      });

      if (!authResult.success) {
        Alert.alert("Authentication Failed", "We could not verify your identity.");
        return;
      }
      
      // Pull the PIN silently from the hardware enclave
      const stored = await SecureStore.getItemAsync(PIN_KEY);
      if (stored) activePin = stored;
    } else {
      // 2. Manual entry fallback
      if (activePin.length < 4) {
        Alert.alert("Error", "Please enter a PIN of at least 4 characters.");
        return;
      }
    }

    // 3. Execute the requested action using the resolved PIN
    if (actionType === 'backup') {
      await performBackup(activePin);
    } else {
      await performRestore(activePin);
    }
  };

  // --- UPLOAD LOGIC ---
  const performBackup = async (encryptionPin: string) => {
    setLoading(true);
    try {
      setStatusText('Reading local database...');
      const db = await getDatabase();
      const allPatients = await db.getAllAsync('SELECT * FROM patients;');

      if (allPatients.length === 0) {
        Alert.alert("Empty", "No patients to backup.");
        setLoading(false);
        return;
      }

      setStatusText('Encrypting data (AES-256)...');
      const jsonString = JSON.stringify(allPatients);
      const encryptedData = CryptoJS.AES.encrypt(jsonString, encryptionPin).toString();

      setStatusText('Uploading to secure vault...');
      const uploadTask = uploadData({
        path: ({ identityId }) => `private/${identityId}/backup.enc`,
        data: encryptedData,
        options: { contentType: 'text/plain' }
      });
      
      await uploadTask.result;

      // If this was a manual entry, save the PIN to the hardware enclave for next time!
      if (!hasSavedPin) {
        await SecureStore.setItemAsync(PIN_KEY, encryptionPin);
        setHasSavedPin(true);
      }

      Alert.alert("Success", "Data successfully encrypted and backed up to the cloud!");
      setStatusText('Backup complete.');
      setPin('');
    } catch (error: any) {
      console.log(error);
      Alert.alert("Backup Failed", error.message);
      setStatusText('Backup failed.');
    } finally {
      setLoading(false);
    }
  };

  // --- DOWNLOAD LOGIC ---
  const performRestore = async (decryptionPin: string) => {
    setLoading(true);
    try {
      setStatusText('Downloading from vault...');
      const downloadTask = downloadData({
        path: ({ identityId }) => `private/${identityId}/backup.enc`
      });
      
      const result = await downloadTask.result;
      const encryptedText = await result.body.text();

      setStatusText('Decrypting data...');
      const bytes = CryptoJS.AES.decrypt(encryptedText, decryptionPin);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedString) {
        throw new Error("Incorrect PIN. Decryption failed.");
      }

      const patients = JSON.parse(decryptedString);

      setStatusText('Rebuilding local database...');
      const db = await getDatabase();
      await db.execAsync('DELETE FROM patients;');
      
      for (const p of patients) {
        await db.runAsync(
          'INSERT INTO patients (id, name, mother_name, age, gender, phone, diagnosis, prescription, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
          [p.id, p.name, p.mother_name || 'N/A', p.age || 0, p.gender || 'Not Specified', p.phone || 'N/A', p.diagnosis || 'General Visit', p.prescription || 'None', p.created_at]
        );
      }

      // If this was a manual entry, save the PIN for next time!
      if (!hasSavedPin) {
        await SecureStore.setItemAsync(PIN_KEY, decryptionPin);
        setHasSavedPin(true);
      }

      Alert.alert("Success", `Restored ${patients.length} patient records!`);
      setStatusText('Restore complete.');
      setPin('');
    } catch (error: any) {
      console.log(error);
      Alert.alert("Restore Failed", "Could not find backup or wrong PIN.");
      setStatusText('Restore failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: "Cloud Sync", 
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#2c3e50',
          headerShadowVisible: false,
        }} 
      />
      
      <View style={styles.card}>
        <Text style={styles.title}>Encrypted Vault</Text>
        
        {userEmail && <Text style={styles.userLabel}>Logged in as: {userEmail}</Text>}
        
        <Text style={styles.subtitle}>
          Your data is locked with AES-256 before leaving the device.
        </Text>

        {/* Dynamic UI: Show either the Biometric lock or the Manual PIN input */}
        {hasSavedPin ? (
          <View style={styles.biometricContainer}>
             <Text style={styles.biometricText}>🛡️ Master PIN secured on device.</Text>
             <Text style={styles.biometricSubText}>You will be prompted for FaceID / Fingerprint to sync.</Text>
          </View>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Enter 4-Digit Encryption PIN"
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
            editable={!loading}
          />
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8e44ad" />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        ) : (
          <View>
            <TouchableOpacity style={styles.backupButton} onPress={() => executeVaultAction('backup')}>
              <Text style={styles.buttonText}>
                {hasSavedPin ? "⬆️ Authenticate & Backup" : "⬆️ Set PIN & Backup"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.restoreButton} onPress={() => executeVaultAction('restore')}>
              <Text style={styles.buttonText}>
                {hasSavedPin ? "⬇️ Authenticate & Restore" : "⬇️ Set PIN & Restore"}
              </Text>
            </TouchableOpacity>

            {/* Hardware Management / Logout */}
            <View style={styles.footerRow}>
              {hasSavedPin && (
                <TouchableOpacity style={styles.footerButton} onPress={clearSavedPin}>
                  <Text style={styles.footerText}>Reset PIN</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.footerButton} onPress={handleSignOut}>
                <Text style={styles.footerText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20, justifyContent: 'center' },
  card: { backgroundColor: '#fff', padding: 25, borderRadius: 12, elevation: 3 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4, textAlign: 'center' },
  userLabel: { fontSize: 13, color: '#8e44ad', fontWeight: '600', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 13, color: '#7f8c8d', marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  
  // New Biometric Styles
  biometricContainer: { backgroundColor: '#f0f8ff', padding: 15, borderRadius: 8, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#d6eaf8' },
  biometricText: { color: '#2980b9', fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  biometricSubText: { color: '#7f8c8d', fontSize: 12, textAlign: 'center' },
  
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e0e0e0', padding: 15, borderRadius: 8, marginBottom: 20, fontSize: 16, textAlign: 'center', letterSpacing: 5 },
  backupButton: { backgroundColor: '#27ae60', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  restoreButton: { backgroundColor: '#e74c3c', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  
  // Footer Row Styles
  footerRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  footerButton: { padding: 12 },
  footerText: { color: '#7f8c8d', fontSize: 14, fontWeight: '600' },
  
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loadingContainer: { alignItems: 'center', paddingVertical: 20 },
  statusText: { marginTop: 10, color: '#8e44ad', fontWeight: '600' }
});