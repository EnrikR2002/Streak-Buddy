import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, Button, Alert, ActivityIndicator, Modal } from 'react-native';
import { db } from '../firebase';
import { useUserStore } from '../store/User';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { theme } from '../theme';
import AppButton from '../components/AppButton';

export default function HabitDetailsScreen({ route, navigation }) {
    const { habit } = route.params;
    const userId = useUserStore(s => s.userId);
    const [proofs, setProofs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

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

    const buddyIds = (habit.members || []).filter(id => id !== habit.ownerId);
    const isWaitingForApproval = proofs[0] && proofs[0].status === 'pending' && proofs[0].submittedBy === userId;

    return (
        <View style={{ flex: 1, backgroundColor: theme.background, paddingHorizontal: 18, paddingTop: 24 }}>
            <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 8 }}>{habit.name}</Text>
            <Text>Current Streak: {habit.streak ?? 0}</Text>
            <Text>Best Streak: {habit.bestStreak ?? 0}</Text>
            <Text>Buddy ID(s): {buddyIds.length ? buddyIds.join(', ') : 'None'}</Text>
            {isWaitingForApproval && (
                <AppButton title="Nudge Buddy" onPress={() => Alert.alert('Nudge sent! (Push notification coming soon)')} style={{ width: 180, alignSelf: 'center' }} />
            )}
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginVertical: 16 }}>Proof Submissions</Text>
            {loading ? <ActivityIndicator /> : null}
            {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
            {!loading && proofs.length === 0 && <Text>No submissions yet.</Text>}
            <FlatList
                data={proofs}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => { setSelectedImage(item.url); setModalVisible(true); }}>
                        <View style={{ backgroundColor: theme.card, borderRadius: theme.borderRadius, padding: 16, marginVertical: 10, flexDirection: 'row', alignItems: 'center', ...theme.shadow }}>
                            <Image source={{ uri: item.url }} style={{ width: 60, height: 60, borderRadius: 8, marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text>Date: {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : '...'}</Text>
                                <Text>Uploader: {item.submittedBy === userId ? 'You' : item.submittedBy}</Text>
                                <Text>Status: {item.status}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
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
