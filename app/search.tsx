import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { getDatabase } from '../db/database';

export default function SearchScreen() {
  const [searchName, setSearchName] = useState('');
  const [searchMother, setSearchMother] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  
  const [results, setResults] = useState<any[]>([]);
  // --- Delete Logic ---
  const router=useRouter();
  const params = useLocalSearchParams();
  const deletePatient = async (id: number) => {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM patients WHERE id = ?;', [id]);
      
      // Re-trigger the search to instantly remove the card from the screen
      setResults(prev => prev.filter(p => p.id !== id));
    } catch (error: any) {
      Alert.alert("Error", "Failed to delete: " + (error?.message || "Unknown error"));
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

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const db = await getDatabase();
        // This query demands that ALL typed fields match the database.
        // IFNULL prevents crashes if an older patient is missing a mother_name.
        const matches = await db.getAllAsync(
          `SELECT * FROM patients 
           WHERE IFNULL(name, '') LIKE ? 
           AND IFNULL(mother_name, '') LIKE ? 
           AND IFNULL(phone, '') LIKE ? 
           ORDER BY created_at DESC;`,
          [`%${searchName}%`, `%${searchMother}%`, `%${searchPhone}%`]
        );
        setResults(matches);
      } catch (error) {
        console.log("Search error:", error);
      }
    };
    fetchResults();
  }, [searchName, searchMother, searchPhone]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <Stack.Screen 
        options={{ 
          title: "Search Patients", 
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: '#ffffff' }, // Makes the bar white
          headerTintColor: '#2c3e50', // Makes the back button and text dark blue/gray
          headerShadowVisible: false, // (Optional) Removes the bottom border shadow for a super clean flat look
        }} 
      />
      
      <View style={styles.searchHeader}>
        <Text style={styles.instructions}>Combine fields to narrow your results.</Text>
        
        <TextInput style={styles.input} placeholder="Patient Name" value={searchName} onChangeText={setSearchName} />
        <TextInput style={styles.input} placeholder="Mother's Name" value={searchMother} onChangeText={setSearchMother} />
        <TextInput style={styles.input} placeholder="Phone Number" value={searchPhone} onChangeText={setSearchPhone} keyboardType="phone-pad" />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.resultCount}>Found {results.length} matches</Text>

        {results.map((patient) => (
          <View key={patient.id} style={styles.patientCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.patientName}>{patient.name}</Text>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  onPress={() => router.navigate({ pathname: '/', params: { editPatientData: JSON.stringify(patient) } })} 
                  style={{ marginRight: 15 }}
                >
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
            <Text style={styles.patientDetail}>Mother's Name: {patient.mother_name || 'N/A'}</Text>
            <Text style={styles.patientDetail}>Phone: {patient.phone} | Age: {patient.age}</Text>
            <Text style={styles.patientDetail}>Diagnosis: {patient.diagnosis}</Text>
            
            {patient.prescription && patient.prescription !== 'None' && (
              <View style={styles.rxBox}>
                <Text style={styles.rxTitle}>Rx / Prescription:</Text>
                <Text style={styles.rxText}>{patient.prescription}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  searchHeader: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  instructions: {
    color: '#7f8c8d',
    marginBottom: 10,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  scroll: {
    padding: 20,
    paddingBottom: 60,
  },
  resultCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 15,
  },
  patientCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 5,
    borderLeftColor: '#8e44ad',
    elevation: 2,
  },
  patientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  patientDetail: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  rxBox: {
    marginTop: 8, 
    padding: 8, 
    backgroundColor: '#f0f8ff', 
    borderRadius: 5
  },
  rxTitle: {
    fontSize: 14, 
    fontWeight: '600', 
    color: '#2980b9'
  },
  rxText: {
    fontSize: 14, 
    color: '#34495e', 
    marginTop: 2
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  dateText: {
    fontSize: 12,
    color: '#bdc3c7', // A nice subtle light gray
    fontStyle: 'italic',
    marginBottom: 6,
  },
});