import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { useHabitStore } from '../store/Habits';
import { Picker } from '@react-native-picker/picker';

export default function AddHabitScreen({ route, navigation }) {
    const addHabit = useHabitStore(s => s.addHabit);
    const submitProof = useHabitStore(s => s.submitProof);
    const [name, setName] = useState('');
    const [proofType, setProofType] = useState('text');

    // If route.params.id is present, this is proof submission
    if (route.params && route.params.id) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Submit Proof</Text>
                {/* Fake proof for MVP */}
                <Button
                    title="Submit (Fake Text/Photo)"
                    onPress={() => {
                        submitProof(route.params.id);
                        navigation.goBack();
                    }}
                />
            </View>
        );
    }

    // Otherwise, this is add habit flow
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Add New Habit</Text>
            <TextInput
                placeholder="Habit Name"
                value={name}
                onChangeText={setName}
                style={{ borderWidth: 1, borderColor: '#aaa', borderRadius: 8, padding: 8, marginVertical: 12, width: '80%' }}
            />
            <View style={{ marginVertical: 30, marginBottom: 40 }}>
                <Button
                    title="Add Habit"
                    onPress={() => {
                        if (!name.trim()) return;
                        addHabit({ name, proofType });
                        navigation.goBack();
                    }}
                    style={{ marginBottom: 50 }}
                />
            </View>
            <Text>Proof Type:</Text>
            <View style={{ flexDirection: 'row', marginVertical: 15, marginBottom: 80 }}>
                <Button
                    title="Text"
                    color={proofType === 'text' ? '#4caf50' : '#aaa'}
                    onPress={() => setProofType('text')}
                />
                <View style={{ width: 15 }} />
                <Button
                    title="Photo"
                    color={proofType === 'photo' ? '#2196f3' : '#aaa'}
                    onPress={() => setProofType('photo')}
                />
            </View>
        </View>
    );
}
