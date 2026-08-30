# WhatDoc 🩺 ☁️

**WhatDoc** is an offline-first, highly secure mobile application designed to help clinics and doctors manage patient records seamlessly. Built with React Native and an underlying SQLite engine, it provides lightning-fast data entry without requiring an active internet connection. 

For data redundancy and multi-device syncing, WhatDoc features a **Zero-Knowledge Encrypted Cloud Vault** powered by AWS, ensuring that patient data remains strictly confidential and isolated.

---

## ✨ Key Features

*   **Offline-First Architecture:** Core CRUD operations run instantly on a local SQLite database, ensuring zero latency and zero reliance on cellular networks.
*   **Advanced Multi-Parameter Search:** Instantly narrow down patient records using combined query parameters (Name + Mother's Name + Phone) via a strict `AND` SQL filter.
*   **Zero-Knowledge Cloud Sync:** Patient data is converted to JSON and encrypted on the device CPU using AES-256 before ever touching the network.
*   **1-Tap Hardware Encryption:** Utilizes the device's Secure Enclave (Expo Secure Store) to safely store the user's decryption PIN, allowing for 1-tap backups and restores without sacrificing security.
*   **Multi-Tenant Isolation:** Securely separates clinic data in the cloud. Doctor A can never access Doctor B's encrypted vault.

---

## 🏗️ System Architecture

### 1. The Local Layer
The app relies on `expo-sqlite` for all immediate data interactions. This guarantees that the app remains fully functional in remote areas or hospitals with poor connectivity.

### 2. The Identity Gateway
Authentication is handled via **AWS Cognito**. Users create an account (acting as a unique tenant ID) and authenticate to receive temporary, strictly scoped IAM credentials.

### 3. The B2B Cloud Vault
Data syncing utilizes an **AWS S3** bucket acting as a manual backup vault. Access is restricted using dynamic AWS IAM inline policies:

```json
"Resource": ["arn:aws:s3:::whatdoc-vaults/private/${cognito-identity.amazonaws.com:sub}/*"]
```

This policy mathematically guarantees that the temporary token provided by Cognito only grants access to the specific folder matching the user's authenticated ID.

---

## 🛠️ Tech Stack

*   **Frontend:** React Native, Expo Router
*   **Local Database:** SQLite (`expo-sqlite`)
*   **Cloud Infrastructure:** AWS Amplify v6, AWS S3, AWS Cognito
*   **Security & Encryption:** `crypto-js` (AES-256), `expo-secure-store`

---

## 🚀 Local Development Setup

### Prerequisites
*   Node.js installed
*   Expo CLI installed (`npm install -g expo-cli`)
*   An active AWS Account (Cognito & S3 configured)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/whatdoc.git
   cd whatdoc
   ```

2. **Install dependencies:**
   ```bash
   npx expo install
   ```

3. **Configure AWS:**
   Create a file named `aws-config.ts` in the root directory and add your AWS resource IDs:
   ```typescript
   import { Amplify } from 'aws-amplify';

   Amplify.configure({
     Auth: {
       Cognito: {
         userPoolId: 'YOUR_USER_POOL_ID',
         userPoolClientId: 'YOUR_APP_CLIENT_ID',
         identityPoolId: 'YOUR_IDENTITY_POOL_ID',
       }
     },
     Storage: {
       S3: {
         bucket: 'YOUR_S3_BUCKET_NAME',
         region: 'YOUR_AWS_REGION' 
       }
     }
   });
   ```

4. **Run the development server:**
   ```bash
   npx expo start -c
   ```

---

## 🔒 Security Notice
This application processes sensitive medical information. The AWS IAM roles **must** be configured with the exact `${cognito-identity.amazonaws.com:sub}` policy restriction provided in the documentation to ensure cross-tenant data isolation. The AES-256 encryption PIN is never transmitted to the backend; it is stored solely on the device's hardware Keystore.

---

**Developed for modern clinical efficiency by Sarthak.**
