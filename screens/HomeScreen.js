import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useHabitStore } from '../store/Habits';
import { useUserStore } from '../store/User';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function HomeScreen({ navigation }) {
    const habits = useHabitStore(s => s.habits);
    const userId = useUserStore(s => s.userId);
    const [proofs, setProofs] = useState({}); // { habitId: [proofs] }
    const [loadingProofs, setLoadingProofs] = useState(false);

    useEffect(() => {
        if (!userId) return;
        useHabitStore.getState().loadHabits();
        // Listen for proofs for all habits
        setLoadingProofs(true);
        const unsubscribes = habits.map(habit => {
            const q = query(collection(db, `habits/${habit.id}/proofs`), orderBy('timestamp', 'desc'));
            return onSnapshot(q, snap => {
                setProofs(prev => ({ ...prev, [habit.id]: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }));
            });
        });
        setLoadingProofs(false);
        return () => { unsubscribes.forEach(u => u && u()); };
    }, [userId, habits.length]);

    return (
        <View style={{ flex: 1, padding: 24 }}>
            <Button title="Add Habit" onPress={() => navigation.navigate('AddHabit')} />
            <Text style={{ fontSize: 22, fontWeight: 'bold', marginVertical: 16 }}>Your Habits</Text>
            <FlatList
                data={habits}
                keyExtractor={item => item.id}
                ListEmptyComponent={<Text>No habits yet. Add one!</Text>}
                renderItem={({ item }) => {
                    const habitProofs = proofs[item.id] || [];
                    // Only consider proofs from today
                    const today = new Date().toDateString();
                    const todaysProof = habitProofs.find(p => {
                        if (!p.timestamp) return false;
                        try {
                            const proofDate = p.timestamp.toDate
                                ? p.timestamp.toDate()
                                : new Date(p.timestamp);
                            return proofDate.toDateString() === today;
                        } catch (e) {
                            return false;
                        }
                    });
                    const latestProof = todaysProof || null; return (
                        <TouchableOpacity onPress={() => navigation.navigate('HabitDetails', { habit: item })}>
                            <View style={{ borderWidth: 1, borderColor: '#aaa', padding: 12, marginBottom: 12, borderRadius: 8 }}>
                                <Text style={{ fontSize: 18, fontWeight: '600' }}>{item.name}</Text>
                                {latestProof ? (
                                    <>
                                        <Text>Status: {latestProof.status}</Text>
                                        <Image source={{ uri: latestProof.url }} style={{ width: 120, height: 120, marginVertical: 8, borderRadius: 8 }} />
                                        <Text>Submitted by: {latestProof.submittedBy === userId ? 'You' : 'Buddy'}</Text>
                                        {latestProof.status === 'pending' && userId !== latestProof.submittedBy && (
                                            <View style={{ flexDirection: 'row', marginTop: 8 }}>
                                                <TouchableOpacity onPress={async () => {
                                                    await useHabitStore.getState().approveProof(item.id, latestProof.id);
                                                }} style={{ marginRight: 12 }}>
                                                    <Text style={{ color: 'green', fontWeight: 'bold' }}>Approve</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={async () => {
                                                    await useHabitStore.getState().rejectProof(item.id, latestProof.id);
                                                }}>
                                                    <Text style={{ color: 'red', fontWeight: 'bold' }}>Reject</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        {latestProof.status === 'pending' && latestProof.submittedBy === userId && (
                                            <Text style={{ color: '#888', marginTop: 8 }}>Waiting for buddy to approve...</Text>
                                        )}
                                        {latestProof.status === 'approved' && (
                                            <Text style={{ color: 'green', marginTop: 8 }}>Proof approved!</Text>
                                        )}
                                        {latestProof.status === 'rejected' && (
                                            <Text style={{ color: 'red', marginTop: 8 }}>Proof rejected.</Text>
                                        )}
                                    </>
                                ) : (
                                    <Button title="Submit Proof" onPress={() => navigation.navigate('AddHabit', { id: item.id })} />
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
}
