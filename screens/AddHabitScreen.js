import React, { useState, useEffect } from 'react';
import { View, Text, Button, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHabitStore } from '../store/Habits';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { theme } from '../theme';
import CustomHeader from '../components/CustomHeader';

export default function AddHabitScreen({ route, navigation }) {
    const createHabitWithCode = useHabitStore(s => s.createHabitWithCode);
    const joinHabitByCode = useHabitStore(s => s.joinHabitByCode);
    const submitProof = useHabitStore(s => s.submitProof);
    const [mode, setMode] = useState('choose');
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [createdCode, setCreatedCode] = useState('');
    const [image, setImage] = useState(null);

    if (mode === 'created') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <CustomHeader title="Habit Created" onBack={() => navigation.goBack()} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Share this code with your buddy:</Text>
                    <Text selectable style={{ fontSize: 28, letterSpacing: 4, margin: 20 }}>{createdCode}</Text>
                    <Text>Have your buddy enter this code to join this habit.</Text>
                    <Button title="Go to Home" onPress={() => navigation.goBack()} />
                </View>
            </SafeAreaView>
        );
    }

    if (mode === 'join') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <CustomHeader title="Join Habit" onBack={() => setMode('choose')} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Join a Habit</Text>
                    <TextInput
                        placeholder="Enter habit code"
                        value={code}
                        onChangeText={setCode}
                        autoCapitalize="characters"
                        style={{ borderWidth: 1, borderColor: '#aaa', borderRadius: 8, padding: 8, marginVertical: 12, width: '80%' }}
                    />
                    <Button
                        title="Join Habit"
                        onPress={async () => {
                            try {
                                await joinHabitByCode(code);
                                navigation.goBack();
                            } catch (e) {
                                Alert.alert('Error', e.message);
                            }
                        }}
                    />
                    <Button title="Back" onPress={() => setMode('choose')} />
                </View>
            </SafeAreaView>
        );
    }

    if (mode === 'add') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <CustomHeader title="Create Habit" onBack={() => setMode('choose')} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Create New Habit</Text>
                    <TextInput
                        placeholder="Habit Name"
                        value={name}
                        onChangeText={setName}
                        style={{ borderWidth: 1, borderColor: '#aaa', borderRadius: 8, padding: 8, marginVertical: 12, width: '80%' }}
                    />
                    <Button
                        title="Create Habit"
                        onPress={async () => {
                            if (!name.trim()) return;
                            const code = await createHabitWithCode({ name });
                            setCreatedCode(code);
                            setMode('created');
                        }}
                    />
                    <Button title="Back" onPress={() => setMode('choose')} />
                </View>
            </SafeAreaView>
        );
    }

    // If route.params.id is present, this is proof submission
    if (route.params && route.params.id) {
        async function pickImage() {
            try {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission required', 'You need to grant photo library permission to submit proof.');
                    return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: false, // Don't force cropping/resizing
                    quality: 1, // Pick at full quality, we'll compress after
                });
                let pickedUri = null;
                if (result && !result.canceled && result.assets && result.assets.length > 0) {
                    pickedUri = result.assets[0].uri;
                } else if (result && !result.canceled && result.uri) {
                    pickedUri = result.uri;
                } else if (result && result.canceled) {
                    Alert.alert('Cancelled', 'No photo selected.');
                    return;
                } else {
                    Alert.alert('Error', 'No result from image picker.');
                    return;
                }
                // Compress to 70% quality, keep original size
                const manipulated = await ImageManipulator.manipulateAsync(
                    pickedUri,
                    [],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
                );
                setImage(manipulated.uri);
            } catch (e) {
                Alert.alert('Error', e.message || String(e));
            }
        }
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <CustomHeader title="Submit Proof" onBack={() => navigation.goBack()} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Submit Photo Proof</Text>
                    <Button
                        title={image ? "Photo Selected" : "Pick a Photo"}
                        onPress={pickImage}
                    />
                    {image && <Text style={{ marginVertical: 10 }}>Photo ready to submit!</Text>}
                    <Button
                        title="Submit Photo"
                        disabled={!image}
                        onPress={async () => {
                            try {
                                await submitProof(route.params.id, image);
                                navigation.goBack();
                            } catch (e) {
                                Alert.alert('Error', e.message || String(e));
                            }
                        }}
                    />
                </View>
            </SafeAreaView>
        );
    }

    // Choose mode
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <CustomHeader title="Add or Join" onBack={() => navigation.goBack()} />
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 30 }}>Add or Join a Habit</Text>
                <Button title="Create New Habit" onPress={() => setMode('add')} />
                <View style={{ height: 30 }} />
                <Button title="Join with Code" onPress={() => setMode('join')} />
                <View style={{ height: 30 }} />
                <Button title="Back to Home" onPress={() => navigation.goBack()} />
            </View>
        </SafeAreaView>
    );
}
