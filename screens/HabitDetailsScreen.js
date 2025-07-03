import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, Button, Alert, ActivityIndicator, Modal } from 'react-native';
import { db } from '../firebase';
import { useUserStore } from '../store/User';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { theme } from '../theme';
import AppButton from '../components/AppButton';
import * as Haptics from 'expo-haptics';

export default function HabitDetailsScreen({ route, navigation }) {
    const { habit } = route.params;
    const userId = useUserStore(s => s.userId);
    const [proofs, setProofs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [nudgeFlash, setNudgeFlash] = useState(false);
    const nudgeTimeoutRef = useRef();

    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, `habits/${habit.id}/proofs`), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, snap => {
            setProofs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, err => {
            setError(err.message);
            setLoading(false);
        });
        return unsubscribe;
    }, [habit.id]);

    useEffect(() => {
        return () => {
            if (nudgeTimeoutRef.current) {
                clearTimeout(nudgeTimeoutRef.current);
            }
        };
    }, []);

    const buddyIds = (habit.members || []).filter(id => id !== habit.ownerId);
    const isWaitingForApproval = proofs[0] && proofs[0].status === 'pending' && proofs[0].submittedBy === userId;

    return (
        <View style={{ flex: 1, backgroundColor: theme.background, paddingHorizontal: 18, paddingTop: 24 }}>
            <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 8 }}>{habit.name}</Text>
            <Text>Current Streak: {habit.streak ?? 0}</Text>
            <Text>Best Streak: {habit.bestStreak ?? 0}</Text>
            <Text>Buddy ID(s): {buddyIds.length ? buddyIds.join(', ') : 'None'}</Text>
            {isWaitingForApproval && (
                <AppButton
                    title="Nudge Buddy"
                    onPress={async () => {
                        try {
                            await Haptics.selectionAsync();
                        } catch (e) {
                            // Optionally log or handle haptics error
                        }
                        setNudgeFlash(true);
                        if (nudgeTimeoutRef.current) {
                            clearTimeout(nudgeTimeoutRef.current);
                        }
                        nudgeTimeoutRef.current = setTimeout(() => setNudgeFlash(false), 100);
                        // TODO: Add notification sending logic here
                    }}
                    style={{ width: 180, alignSelf: 'center', backgroundColor: nudgeFlash ? theme.accent : theme.primary }}
                />
            )}
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: theme.text, marginVertical: 10, alignSelf: 'center' }}>Proof Submissions</Text>
            {loading ? <ActivityIndicator /> : null}
            {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
            {!loading && proofs.length === 0 && <Text>No submissions yet.</Text>}
            <FlatList
                key={2}
                data={proofs}
                keyExtractor={item => item.id}
                numColumns={2}
                contentContainerStyle={{ gap: 10 }}
                columnWrapperStyle={{ gap: 10 }}
                renderItem={({ item }) => {
                    const isMe = item.submittedBy === userId;
                    return (
                        <TouchableOpacity onPress={() => { setSelectedImage(item.url); setModalVisible(true); }}>
                            <View style={{
                                flex: 1,
                                borderColor: isMe ? theme.mySubBorder : theme.buddySubBorder,
                                borderWidth: 2,
                                borderRadius: 12,
                                marginVertical: 6,
                                marginHorizontal: 2,
                                alignSelf: isMe ? 'flex-start' : 'flex-end',
                                backgroundColor: theme.card,
                                padding: 6,
                                alignItems: 'center',
                            }}>
                                <Image source={{ uri: item.url }} style={{ width: 120, height: 120, borderRadius: 12, marginBottom: 6 }} />
                                <Text style={{ fontSize: 12, color: theme.text, textAlign: 'center' }}>{item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : '...'}</Text>
                                <Text style={{ fontSize: 12, color: theme.text, textAlign: 'center' }}>{isMe ? 'You' : item.submittedBy}</Text>
                                <Text style={{ fontSize: 12, color: theme.text, textAlign: 'center' }}>{item.status}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />
            <Modal visible={modalVisible} transparent={true} onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' }}>
                    <TouchableOpacity style={{ flex: 1, width: '100%' }} onPress={() => setModalVisible(false)}>
                        {selectedImage && (
                            <Image source={{ uri: selectedImage }} style={{ width: '90%', height: '70%', resizeMode: 'contain', alignSelf: 'center' }} />
                        )}
                    </TouchableOpacity>
                </View>
            </Modal>
        </View>
    );
}
