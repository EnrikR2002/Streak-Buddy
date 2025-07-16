import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { theme } from '../theme';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [mode, setMode] = useState('login'); // 'login' or 'register'
    const [loading, setLoading] = useState(false);
    const iosClientId = Constants.expoConfig.extra.IOS_CLIENT_ID;

    // Google Auth
    const [request, response, promptAsync] = Google.useAuthRequest({
        expoClientId: '',
        iosClientId,
        androidClientId: '',
        webClientId: '',
    });

    React.useEffect(() => {
        if (response?.type === 'success') {
            const { id_token } = response.params;
            const credential = GoogleAuthProvider.credential(id_token);
            signInWithCredential(auth, credential)
                .then(async (userCred) => {
                    await ensureUserInFirestore(userCred.user);
                })
                .catch((e) => Alert.alert('Google Sign-In Error', e.message));
        }
    }, [response]);

    async function ensureUserInFirestore(user) {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            // Prompt for username if needed
            let uname = username;
            if (!uname) uname = user.displayName || user.email.split('@')[0];
            await setDoc(userRef, {
                userID: user.uid,
                email: user.email,
                username: uname,
                createdAt: new Date().toISOString(),
            });
        }
        // TODO: Navigate to HomeScreen after login
    }

    async function handleEmailLogin() {
        setLoading(true);
        try {
            const userCred = await signInWithEmailAndPassword(auth, email, password);
            await ensureUserInFirestore(userCred.user);
        } catch (e) {
            Alert.alert('Login Error', e.message);
        }
        setLoading(false);
    }

    async function handleEmailRegister() {
        setLoading(true);
        try {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            await ensureUserInFirestore({ ...userCred.user, username });
        } catch (e) {
            Alert.alert('Register Error', e.message);
        }
        setLoading(false);
    }

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
            <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 24 }}>Streak Buddy Login</Text>
            {mode === 'register' && (
                <TextInput
                    placeholder="Username"
                    value={username}
                    onChangeText={setUsername}
                    style={{ ...inputStyle, marginBottom: 12 }}
                />
            )}
            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={inputStyle}
            />
            <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={inputStyle}
            />
            {mode === 'login' ? (
                <>
                    <Button title="Login" onPress={handleEmailLogin} disabled={loading} />
                    <Button title="Register" onPress={() => setMode('register')} disabled={loading} />
                </>
            ) : (
                <>
                    <Button title="Register" onPress={handleEmailRegister} disabled={loading} />
                    <Button title="Back to Login" onPress={() => setMode('login')} disabled={loading} />
                </>
            )}
            <View style={{ height: 24 }} />
            <Button
                title="Sign in with Google"
                onPress={() => promptAsync()}
                disabled={!request || loading}
            />
            {/* Apple sign-in can be added here for iOS */}
        </View>
    );
}

const inputStyle = {
    width: 260,
    padding: 10,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#fff',
};
