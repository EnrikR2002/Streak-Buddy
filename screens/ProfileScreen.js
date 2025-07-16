import React, { useEffect, useState } from 'react';
import { View, Text, Button, ActivityIndicator, Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useUserStore } from '../store/User';
import { theme } from '../theme';

export default function ProfileScreen({ navigation }) {
    const userId = useUserStore(s => s.userId);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchUser() {
            if (!userId) return;
            setLoading(true);
            try {
                const snap = await getDoc(doc(db, 'users', userId));
                setUserData(snap.exists() ? snap.data() : null);
            } catch (e) {
                Alert.alert('Error', e.message);
            }
            setLoading(false);
        }
        fetchUser();
    }, [userId]);

    async function handleLogout() {
        try {
            await signOut(auth);
        } catch (e) {
            Alert.alert('Logout Error', e.message);
        }
    }

    if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
            <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20 }}>Profile</Text>
            <Text style={{ fontSize: 18, marginBottom: 8 }}>Email: {userData?.email || 'N/A'}</Text>
            <Text style={{ fontSize: 18, marginBottom: 8 }}>Username: {userData?.username || 'N/A'}</Text>
            <Text style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>User ID: {userId}</Text>
            <Button title="Logout" onPress={handleLogout} color={theme.accent || '#FF7096'} />
        </View>
    );
}
