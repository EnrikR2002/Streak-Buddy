import React, { useState } from 'react';
import { View, Text, Button, TextInput, Alert } from 'react-native';
import { db } from '../firebase';
import { collection, addDoc, doc, setDoc, getDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { useUserStore } from '../store/User';
import { theme } from '../theme';

function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function PairScreen({ navigation }) {
    const setUser = useUserStore(s => s.setUser);
    const [mode, setMode] = useState('idle');
    const [code, setCode] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');

    // Create a pairing code
    async function handleCreateCode() {
        const myCode = generateCode();
        // Add to Firestore as pending
        const docRef = await addDoc(collection(db, 'pairings'), {
            code: myCode,
            paired: false,
            created: Date.now(),
        });
        setGeneratedCode(myCode);
        setUser(docRef.id, null, myCode);
        setMode('created');
    }

    // Enter pairing code and join
    async function handleJoinBuddy() {
        // Find pairing code
        const q = query(collection(db, 'pairings'), where('code', '==', code.toUpperCase()));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            Alert.alert('Not found', 'That code does not exist.');
            return;
        }
        const docData = snapshot.docs[0];
        const pairingId = docData.id;
        const pairing = docData.data();

        if (pairing.paired) {
            Alert.alert('Used', 'That code has already been used.');
            return;
        }
        // Mark as paired, set both buddy IDs
        await updateDoc(doc(db, 'pairings', pairingId), { paired: true });

        // Simulate "user" creation with pairing
        setUser(pairingId, pairingId, code.toUpperCase()); // You and buddy have same pairing id (MVP)
        Alert.alert('Paired!', 'You are now paired. Start using the app!');
        navigation.replace('Home');
    }

    // If code created, show it and wait for buddy
    if (mode === 'created') {
        return (
            <View style={{ flex: 1, backgroundColor: theme.background, paddingHorizontal: 18, paddingTop: 24, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Share this code with your buddy:</Text>
                <Text selectable style={{ fontSize: 28, letterSpacing: 4, margin: 20 }}>{generatedCode}</Text>
                <Text>Have your buddy enter this code to pair.</Text>
                <Button title="Go to App" onPress={() => navigation.replace('Home')} />
            </View>
        );
    }

    // Main pairing UI
    return (
        <View style={{ flex: 1, backgroundColor: theme.background, paddingHorizontal: 18, paddingTop: 24, justifyContent: 'center', alignItems: 'center', marginTop: -175 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 40 }}>Pair With Your Buddy</Text>
            <Button title="Create Pairing Code" onPress={handleCreateCode} />
            <Text style={{ marginVertical: 20, fontWeight: 'bold' }}>OR</Text>
            <TextInput
                placeholder="Enter buddy's code"
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                style={{ borderWidth: 1, borderColor: '#aaa', borderRadius: 8, padding: 10, width: '70%', marginBottom: 12, fontSize: 18 }}
            />
            <Button title="Join with Code" onPress={handleJoinBuddy} />
        </View>
    );
}
