import { Stack } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  Alert
} from 'react-native';
import { initializeDatabase, getDatabase } from '../db/database';

export default function App() {
  // --- Scroll Reference for Auto-scrolling ---
  const scrollViewRef = useRef<ScrollView>(null);

  // --- Form States ---
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  
  // --- Data States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<any[]>([]);

  // --- Initialization ---
  useEffect(() => {
    const setup = async () => {
      await initializeDatabase();
      fetchPatients();
    };
    setup();
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [searchQuery]);

  // --- Database Functions ---

  const fetchPatients = async () => {
    try {
      const db = await getDatabase();
      const allRows = await db.getAllAsync(
        'SELECT * FROM patients WHERE name LIKE ? ORDER BY created_at DESC;',
        [`%${searchQuery}%`]
      );
      setPatients(allRows);
    } catch (error) {
      console.log("Error fetching patients:", error);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing Info", "Please enter a patient name!");
      return;
    }
    if (editingId) {
      await updatePatient();
    } else {
      await addPatient();
    }
  };

  const addPatient = async () => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        'INSERT INTO patients (name, age, gender, phone, diagnosis) VALUES (?, ?, ?, ?, ?);',
        [name, parseInt(age) || 0, gender || 'Not Specified', phone || 'N/A', diagnosis || 'General Visit']
      );
      
      resetForm();
      fetchPatients();
      Alert.alert("Success", "Patient saved to local storage.");
    } catch (error: any) {
      Alert.alert("Error", "Failed to save: " + (error?.message || JSON.stringify(error)));
    }
  };

  const updatePatient = async () => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        'UPDATE patients SET name = ?, age = ?, gender = ?, phone = ?, diagnosis = ? WHERE id = ?;',
        [name, parseInt(age) || 0, gender || 'Not Specified', phone || 'N/A', diagnosis || 'General Visit', editingId]
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

  // --- UI Helpers ---

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

  // Triggered when "Edit" is tapped
  const handleEditClick = (patient: any) => {
    setEditingId(patient.id);
    setName(patient.name);
    setAge(patient.age ? patient.age.toString() : '');
    setGender(patient.gender);
    setPhone(patient.phone);
    setDiagnosis(patient.diagnosis);

    // Smoothly scroll back to the top of the screen!
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setAge('');
    setGender('');
    setPhone('');
    setDiagnosis('');
    setSearchQuery('');
  };

  // --- UI Render ---
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#f5f5f5' }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ADD THIS LINE RIGHT HERE to hide the default header */}
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView 
        ref={scrollViewRef} // Attached the reference here!
        contentContainerStyle={styles.scroll} 
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Branding Header */}
        <Text style={styles.headerTitle}>WHAT doc!!!</Text>

        {/* Input Form Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {editingId ? "Edit Patient Details" : "Add New Patient"}
          </Text>
          
          <TextInput style={styles.input} placeholder="Patient Name" value={name} onChangeText={setName} />
          
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.halfInput]} placeholder="Age" value={age} onChangeText={setAge} keyboardType="numeric" />
            <TextInput style={[styles.input, styles.halfInput]} placeholder="Gender" value={gender} onChangeText={setGender} />
          </View>

          <TextInput style={styles.input} placeholder="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder="Diagnosis / Notes" value={diagnosis} onChangeText={setDiagnosis} multiline />

          {/* Dynamic Buttons */}
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

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput 
            style={styles.searchInput} 
            placeholder="Search patients by name..." 
            value={searchQuery} 
            onChangeText={setSearchQuery} 
          />
        </View>

        {/* Saved Patients List */}
        <Text style={styles.sectionTitle}>Saved Patients ({patients.length})</Text>
        
        {patients.map((patient) => (
          <View key={patient.id} style={styles.patientCard}>
            
            <View style={styles.cardHeader}>
              <Text style={styles.patientName}>{patient.name}</Text>
              
              {/* Edit & Delete Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={() => handleEditClick(patient)} style={{ marginRight: 15 }}>
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(patient.id, patient.name)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.patientDetail}>Age: {patient.age} | Gender: {patient.gender}</Text>
            <Text style={styles.patientDetail}>Phone: {patient.phone}</Text>
            <Text style={styles.patientDetail}>Diagnosis: {patient.diagnosis}</Text>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
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
  searchContainer: {
    marginBottom: 15,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#3498db',
    padding: 12,
    borderRadius: 8,
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
});