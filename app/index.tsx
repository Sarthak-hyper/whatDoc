import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import '../aws-config';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { initializeDatabase, getDatabase } from '../db/database';

const AI_ASSIST_URL = process.env.EXPO_PUBLIC_AI_ASSIST_URL || '';
const AI_DEMO_KEY = process.env.EXPO_PUBLIC_AI_DEMO_KEY || '';

export default function App() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);

  // --- Form States ---
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [motherName, setMotherName] = useState('');
  const [prescription, setPrescription] = useState('');

  // --- AI Assist States ---
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // --- Data States ---
  const [patients, setPatients] = useState<any[]>([]);

  // --- Initialization ---
  useEffect(() => {
    const setup = async () => {
      await initializeDatabase();
    };
    setup();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPatients();
    }, [])
  );

  // --- Database Functions ---
  const fetchPatients = async () => {
    try {
      const db = await getDatabase();
      const allRows = await db.getAllAsync(
        'SELECT * FROM patients ORDER BY created_at DESC;'
      );
      setPatients(allRows);
    } catch (error) {
      console.log("Error fetching patients:", error);
    }
  };

  // --- AI Assist RAG Handler ---
  const handleAiAssist = async () => {
    const cleanDiagnosis = diagnosis.trim().slice(0, 200);
    if (!cleanDiagnosis) {
      Alert.alert("Diagnosis Required", "Please enter a diagnosis before using AI Assist.");
      return;
    }

    if (!AI_ASSIST_URL || !AI_DEMO_KEY) {
      setAiError("AI Assist is not configured. Check EXPO_PUBLIC_AI_ASSIST_URL and EXPO_PUBLIC_AI_DEMO_KEY in .env.");
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiRecommendation(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    try {
      // PRIVACY RULE: Only send diagnosis, age, and gender (never name, phone, or mother_name)
      const payload: { diagnosis: string; age?: number; gender?: string } = {
        diagnosis: cleanDiagnosis,
      };
      const parsedAge = parseInt(age, 10);
      if (!isNaN(parsedAge) && parsedAge > 0) {
        payload.age = parsedAge;
      }
      if (gender.trim()) {
        payload.gender = gender.trim();
      }

      const response = await fetch(AI_ASSIST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-key': AI_DEMO_KEY,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized: Check your demo secret key.");
        }
        throw new Error(data.error || `Server responded with status ${response.status}`);
      }

      setAiRecommendation(data.recommendation || "No recommendation returned.");
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setAiError("Request timed out after 25 seconds. Please try again.");
      } else if (error?.message?.includes('Network request failed')) {
        setAiError("Needs internet connection for AI Assist. All offline features still work normally.");
      } else {
        setAiError(error?.message || "Could not reach AI Assist right now. Offline features still work normally.");
      }
    } finally {
      clearTimeout(timeoutId);
      setAiLoading(false);
    }
  };

  const handleInsertAiSuggestion = () => {
    if (!aiRecommendation) return;
    setPrescription((prev) =>
      prev.trim() ? `${prev.trim()}\n\n${aiRecommendation}` : aiRecommendation
    );
  };

  const handleSave = async () => {
    if (!name.trim() && !motherName.trim()) {
      Alert.alert("Missing Info", "Please enter a patient name!");
      return;
    }
    if (editingId) {
      await updatePatient();
    } else {
      await addPatient();
    }
  };

  const getTimestamp = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
           `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  };

  const addPatient = async () => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        'INSERT INTO patients (name, mother_name, age, gender, phone, diagnosis, prescription, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
        [
          name.trim(), 
          motherName.trim() || 'N/A', 
          parseInt(age) || 0, 
          gender.trim() || 'Not Specified', 
          phone.trim() || 'N/A', 
          diagnosis.trim() || 'General Visit', 
          prescription.trim() || 'None', 
          getTimestamp()
        ]
      );
      resetForm();
      fetchPatients();
      Alert.alert("Success", "Patient saved to local storage.");
    } catch (error: any) {
      Alert.alert("Error", "Failed to save: " + (error?.message || JSON.stringify(error)));
    }
  };

  useEffect(() => {
    if (params.editPatientData && typeof params.editPatientData === 'string') {
      try {
        const patientToEdit = JSON.parse(params.editPatientData);
        handleEditClick(patientToEdit);
        router.setParams({ editPatientData: undefined });
      } catch (error) {
        console.log("Error parsing incoming edit data:", error);
      }
    }
  }, [params.editPatientData]);

  const updatePatient = async () => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        'UPDATE patients SET name = ?, mother_name = ?, age = ?, gender = ?, phone = ?, diagnosis = ?, prescription = ? WHERE id = ?;',
        [
          name.trim(), 
          motherName.trim() || 'N/A', 
          parseInt(age) || 0, 
          gender.trim() || 'Not Specified', 
          phone.trim() || 'N/A', 
          diagnosis.trim() || 'General Visit', 
          prescription.trim() || 'None', 
          editingId
        ]
      );
      resetForm();
      fetchPatients();
      Alert.alert("Success", "Patient details updated.");
    } catch (error: any) {
      Alert.alert("Error", "Failed to update: " + (error?.message || JSON.stringify(error)));
    }
  };

  const deletePatient = async (id: number) => {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM patients WHERE id = ?;', [id]);
      if (editingId === id) resetForm(); 
      fetchPatients();
    } catch (error: any) {
      Alert.alert("Error", "Failed to delete: " + (error?.message || JSON.stringify(error)));
    }
  };

  const confirmDelete = (id: number, patientName: string) => {
    Alert.alert(
      "Delete Patient",
      `Are you sure you want to permanently delete ${patientName}'s records?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deletePatient(id) }
      ]
    );
  };

  const handleEditClick = (patient: any) => {
    setEditingId(patient.id);
    setName(patient.name || '');
    setMotherName(patient.mother_name || '');
    setAge(patient.age ? patient.age.toString() : '');
    setGender(patient.gender || '');
    setPhone(patient.phone || '');
    setDiagnosis(patient.diagnosis || '');
    setPrescription(patient.prescription || '');
    setAiRecommendation(null);
    setAiError(null);

    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setMotherName('');
    setAge('');
    setGender('');
    setPhone('');
    setDiagnosis('');
    setPrescription('');
    setAiRecommendation(null);
    setAiError(null);
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#f5f5f5' }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView 
        ref={scrollViewRef} 
        contentContainerStyle={styles.scroll} 
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {editingId ? "Edit Patient Details" : "Add New Patient"}
          </Text>
          
          <TextInput style={styles.input} placeholder="Patient Name" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Patient's Mother Name" value={motherName} onChangeText={setMotherName} />
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.halfInput]} placeholder="Age" value={age} onChangeText={setAge} keyboardType="numeric" />
            <TextInput style={[styles.input, styles.halfInput]} placeholder="Gender" value={gender} onChangeText={setGender} />
          </View>

          <TextInput style={styles.input} placeholder="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextInput 
            style={styles.input} 
            placeholder="Diagnosis / Notes (e.g., Acute Bronchitis)" 
            value={diagnosis} 
            onChangeText={setDiagnosis} 
            maxLength={200}
            multiline 
          />

          {/* AI ASSIST TRIGGER BUTTON */}
          <TouchableOpacity
            style={[
              styles.aiButton,
              (aiLoading || !diagnosis.trim()) && styles.aiButtonDisabled,
            ]}
            onPress={handleAiAssist}
            disabled={aiLoading || !diagnosis.trim()}
          >
            {aiLoading ? (
              <View style={styles.aiButtonContent}>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.aiButtonText}>Searching Medical Library...</Text>
              </View>
            ) : (
              <Text style={styles.aiButtonText}>✨ AI Assist</Text>
            )}
          </TouchableOpacity>

          {/* AI ERROR BANNER */}
          {aiError && (
            <View style={styles.aiErrorBox}>
              <Text style={styles.aiErrorText}>{aiError}</Text>
            </View>
          )}

          {/* AI SUGGESTION PREVIEW CARD */}
          {aiRecommendation && (
            <View style={styles.aiCard}>
              <View style={styles.aiCardHeader}>
                <Text style={styles.aiDisclaimerBadge}>⚠️ AI suggestion, doctor must verify</Text>
                <TouchableOpacity onPress={() => setAiRecommendation(null)}>
                  <Text style={styles.aiDismissText}>Dismiss</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.aiCardBody}>{aiRecommendation}</Text>

              <TouchableOpacity
                style={styles.aiInsertButton}
                onPress={handleInsertAiSuggestion}
              >
                <Text style={styles.aiInsertButtonText}>⬇ Insert into Prescription</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <TextInput 
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} 
            placeholder="Doctor's Prescription..." 
            value={prescription} 
            onChangeText={setPrescription} 
            multiline 
          />

          <View style={styles.formActionRow}>
            <TouchableOpacity 
              style={[styles.saveButton, editingId ? styles.updateButton : null]} 
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>
                {editingId ? "Update Patient" : "Save to Device Storage"}
              </Text>
            </TouchableOpacity>

            {editingId && (
              <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: '#8e44ad', marginBottom: 20 }]} 
          onPress={() => router.push('/search')}
        >
          <Text style={styles.saveButtonText}>Search From Patients</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: '#2980b9', marginBottom: 20 }]} 
          onPress={() => router.push('/auth')}
        >
          <Text style={styles.saveButtonText}>☁️ Cloud Vault Sync</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Saved Patients ({patients.length})</Text>
        
        {patients.map((patient) => (
          <View key={patient.id} style={styles.patientCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.patientName}>{patient.name}</Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={() => handleEditClick(patient)} style={{ marginRight: 15 }}>
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(patient.id, patient.name)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.dateText}>
              Last Visited: {patient.created_at ? new Date(patient.created_at).toLocaleString() : 'Unknown Date'}
            </Text>
            <Text style={styles.patientDetail}>Mother name: {patient.mother_name}</Text>
            <Text style={styles.patientDetail}>Age: {patient.age} | Gender: {patient.gender}</Text>
            <Text style={styles.patientDetail}>Phone: {patient.phone}</Text>
            <Text style={styles.patientDetail}>Diagnosis: {patient.diagnosis}</Text>
            
            {patient.prescription && patient.prescription !== 'None' && (
              <View style={{ marginTop: 8, padding: 8, backgroundColor: '#f0f8ff', borderRadius: 5 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#2980b9' }}>Rx / Prescription:</Text>
                <Text style={{ fontSize: 14, color: '#34495e', marginTop: 2 }}>{patient.prescription}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 50,
    paddingBottom: 60,
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#34495e',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  aiButton: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  aiButtonDisabled: {
    backgroundColor: '#b2bec3',
  },
  aiButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  aiErrorBox: {
    backgroundColor: '#ffeaa7',
    borderLeftWidth: 4,
    borderLeftColor: '#d63031',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  aiErrorText: {
    color: '#2d3436',
    fontSize: 13,
  },
  aiCard: {
    backgroundColor: '#f4f1ff',
    borderWidth: 1,
    borderColor: '#a29bfe',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  aiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiDisclaimerBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d35400',
    backgroundColor: '#fdebd0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  aiDismissText: {
    fontSize: 12,
    color: '#636e72',
    fontWeight: '600',
  },
  aiCardBody: {
    fontSize: 14,
    color: '#2d3436',
    lineHeight: 20,
    marginBottom: 10,
  },
  aiInsertButton: {
    backgroundColor: '#00b894',
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: 'center',
  },
  aiInsertButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  formActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButton: {
    backgroundColor: '#2ecc71',
    marginRight: 10,
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  patientCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 5,
    borderLeftColor: '#2ecc71',
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  editText: {
    color: '#3498db',
    fontWeight: '600',
  },
  deleteText: {
    color: '#e74c3c',
    fontWeight: '600',
  },
  patientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  patientDetail: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#bdc3c7',
    fontStyle: 'italic',
    marginBottom: 6,
  },
});