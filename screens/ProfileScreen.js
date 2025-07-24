import React, { useEffect, useState } from 'react';
import { View, Text, Button, ActivityIndicator, Alert, TextInput, TouchableOpacity } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { auth, db, storage } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useUserStore } from '../store/User';
import { theme } from '../theme';
import CustomHeader from '../components/CustomHeader';

export default function ProfileScreen({ navigation }) {
    const userId = useUserStore(s => s.userId);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [newProfilePic, setNewProfilePic] = useState(null); // local uri
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function fetchUser() {
            if (!userId) return;
            setLoading(true);
            try {
                const snap = await getDoc(doc(db, 'users', userId));
                setUserData(snap.exists() ? snap.data() : null);
                setNewUsername(snap.exists() ? snap.data().username : '');
            } catch (e) {
                Alert.alert('Error', e.message);
            }
            setLoading(false);
        }
        fetchUser();
    }, [userId]);
    async function pickProfilePic() {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission required', 'You need to grant photo library permission.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaType.IMAGE,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setNewProfilePic(result.assets[0].uri);
            }
        } catch (e) {
            Alert.alert('Error', e.message);
        }
    }

    async function handleSave() {
        setSaving(true);
        let profilePicUrl = userData?.profilePic || 'default';
        try {
            // If new profile pic selected, compress and upload to Firebase Storage
            if (newProfilePic) {
                // Compress image to 75% quality, keep original size
                const manipulated = await ImageManipulator.manipulateAsync(
                    newProfilePic,
                    [],
                    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
                );
                const response = await fetch(manipulated.uri);
                const blob = await response.blob();
                const storageRef = ref(storage, `profilePics/${userId}`);
                await uploadBytes(storageRef, blob);
                profilePicUrl = await getDownloadURL(storageRef);
            }
            // Update Firestore
            await (await import('firebase/firestore')).updateDoc(doc(db, 'users', userId), {
                username: newUsername,
                profilePic: profilePicUrl,
            });
            setUserData({ ...userData, username: newUsername, profilePic: profilePicUrl });
            setEditMode(false);
            setNewProfilePic(null);
        } catch (e) {
            Alert.alert('Save Error', e.message);
        }
        setSaving(false);
    }

    async function handleLogout() {
        try {
            await signOut(auth);
        } catch (e) {
            Alert.alert('Logout Error', e.message);
        }
    }

    if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <CustomHeader title="Profile" onBack={() => navigation.goBack()} />
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <TouchableOpacity disabled={!editMode} onPress={pickProfilePic} style={{ marginBottom: 18 }}>
                    <FastImage
                        source={
                            newProfilePic
                                ? { uri: newProfilePic, priority: FastImage.priority.normal }
                                : (!userData?.profilePic || userData.profilePic === 'default')
                                    ? require('../assets/defaultBuddy.png')
                                    : { uri: userData.profilePic, priority: FastImage.priority.normal }
                        }
                        style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: '#ddd', backgroundColor: '#fff', opacity: editMode ? 0.7 : 1 }}
                        resizeMode={FastImage.resizeMode.cover}
                    />
                    {editMode && <Text style={{ color: theme.accent, textAlign: 'center', marginTop: 4 }}>Change Photo</Text>}
                </TouchableOpacity>
                <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20 }}>Profile</Text>
                <Text style={{ fontSize: 18, marginBottom: 8 }}>Email: {userData?.email || 'N/A'}</Text>
                {editMode ? (
                    <TextInput
                        value={newUsername}
                        onChangeText={setNewUsername}
                        style={{ fontSize: 18, marginBottom: 8, borderWidth: 1, borderColor: '#aaa', borderRadius: 8, padding: 8, width: 200, backgroundColor: '#fff' }}
                        placeholder="Username"
                    />
                ) : (
                    <Text style={{ fontSize: 18, marginBottom: 8 }}>Username: {userData?.username || 'N/A'}</Text>
                )}
                <Text style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>User ID: {userId}</Text>
                {editMode ? (
                    <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                        <Button title="Save" onPress={handleSave} color={theme.accent || '#FF7096'} disabled={saving} />
                        <View style={{ width: 16 }} />
                        <Button title="Cancel" onPress={() => { setEditMode(false); setNewProfilePic(null); setNewUsername(userData?.username || ''); }} disabled={saving} />
                    </View>
                ) : (
                    <Button title="Edit Profile" onPress={() => setEditMode(true)} color={theme.accent || '#FF7096'} />
                )}
                <Button title="Logout" onPress={handleLogout} color={theme.accent || '#FF7096'} />
            </View>
        </SafeAreaView>
    );
}
