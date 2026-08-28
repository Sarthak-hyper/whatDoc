import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { signUp, signIn, confirmSignUp, getCurrentUser } from 'aws-amplify/auth';
import { Stack, useRouter } from 'expo-router';
import 'react-native-get-random-values';
export default function AuthScreen() {
  const router = useRouter();

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        await getCurrentUser();
        // If this succeeds, the user is already signed in! 
        // Instantly bypass the login screen.
        router.replace('/sync');
      } catch (error) {
        // If it fails, no one is logged in. Let them stay and see the login form.
      }
    };
    checkAuthStatus();
  }, []);



  // Form State
  const [name, setName] = useState(''); // NEW STATE
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState(''); // For the email OTP
  
  // UI Navigation State
  const [isSignUp, setIsSignUp] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);

  // --- 1. Create Account ---
  const handleSignUp = async () => {
    // Basic frontend validation so we don't waste a network request
    if (!name.trim()) {
      Alert.alert("Missing Info", "Please enter a clinic name.");
      return;
    }

    try {
      await signUp({
        username: email,
        password,
        options: { 
          userAttributes: { 
            email,
            name // Sends the new attribute to your AWS User Pool
          } 
        }
      });
      setPendingVerification(true);
      Alert.alert("Check your email", "We sent a 6-digit verification code to " + email);
    } catch (error: any) {
      Alert.alert("Sign Up Error", error.message);
    }
  };

  // --- 2. Verify Email OTP ---
  const handleVerify = async () => {
    try {
      await confirmSignUp({
        username: email,
        confirmationCode: code
      });
      Alert.alert("Success!", "Account verified. You can now log in.");
      setPendingVerification(false);
      setIsSignUp(false);
      setCode('');
      setPassword(''); // Clear password for security
    } catch (error: any) {
      Alert.alert("Verification Error", error.message);
    }
  };

  // --- 3. Log In ---
  // --- 3. Log In ---
  // --- 3. Log In ---
  const handleSignIn = async () => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      await signIn({ 
        username: cleanEmail, 
        password: cleanPassword,
        options: {
          authFlowType: 'USER_PASSWORD_AUTH'
        }
      });
      
      Alert.alert("Logged In", "You are successfully connected to the cloud vault.");
      router.replace('/sync'); 
    } catch (error: any) {
      // NEW: Catch the specific "already logged in" error
      if (error.name === 'UserAlreadyAuthenticatedException') {
        router.replace('/sync');
      } else {
        console.log("FULL AWS ERROR:", error);
        Alert.alert("Login Error", error.message);
      }
    }
  };

  // --- Render Verification Screen ---
  // --- Render Verification Screen ---
  if (pendingVerification) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Verify Email", headerBackTitle: "Back" }} />
        <View style={styles.card}>
          <Text style={styles.title}>Enter Verification Code</Text>
          <Text style={styles.subtitle}>Check your email ({email}) for the 6-digit code.</Text>
          
          <TextInput
            style={styles.input}
            placeholder="6-Digit Code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
          />
          
          <TouchableOpacity style={styles.primaryButton} onPress={handleVerify}>
            <Text style={styles.buttonText}>Verify Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- Render Login / Sign Up Screen ---
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen 
              options={{ 
                title: "Access Vault", 
                headerBackTitle: "Back",
                headerStyle: { backgroundColor: '#ffffff' }, // Makes the bar white
                headerTintColor: '#2c3e50', // Makes the back button and text dark blue/gray
                headerShadowVisible: false, // (Optional) Removes the bottom border shadow for a super clean flat look
              }} 
            />
      
      <View style={styles.card}>
        <Text style={styles.title}>{isSignUp ? "Create Account" : "Cloud Login"}</Text>
        <Text style={styles.subtitle}>
          {isSignUp 
            ? "Set up your secure cloud backup vault." 
            : "Log in to sync or restore your patient data."}
        </Text>

        {/* Dynamic Name Input */}
        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Clinic / Doctor Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Clinic Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput
          style={[styles.input, { marginBottom: isSignUp ? 5 : 15 }]}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* Dynamic Password Policy Hint */}
        {isSignUp && (
          <Text style={styles.passwordHint}>
            Password must be of 8+ character and must contain 1 uppercase, 1 lowercase, 1 number, and 1 special character.
          </Text>
        )}

        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={isSignUp ? handleSignUp : handleSignIn}
        >
          <Text style={styles.buttonText}>{isSignUp ? "Sign Up" : "Log In"}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toggleButton} 
          onPress={() => setIsSignUp(!isSignUp)}
        >
          <Text style={styles.toggleText}>
            {isSignUp ? "Already have an account? Log In" : "Need a vault? Sign Up"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#8e44ad',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
  },
  passwordHint: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 15,
    paddingHorizontal: 5,
    fontStyle: 'italic',
  },
});