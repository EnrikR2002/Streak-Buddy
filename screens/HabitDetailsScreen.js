import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Button, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebase';
import { useUserStore } from '../store/User';
import { collection, query, orderBy, limit, startAfter, getDocs, where } from 'firebase/firestore';
import { useHabitStore } from '../store/Habits';
import { theme } from '../theme';
import AppButton from '../components/AppButton';
import CustomHeader from '../components/CustomHeader';
import * as Haptics from 'expo-haptics';
import { getPushTokenForUser, sendPushNotification } from '../utils/push';

export default function HabitDetailsScreen({ route, navigation }) {
    const { habit } = route.params;
    const userId = useUserStore(s => s.userId);
    const [proofs, setProofs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastDoc, setLastDoc] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [nudgeFlash, setNudgeFlash] = useState(false);
    const nudgeTimeoutRef = useRef();
    const [inviteModal, setInviteModal] = useState(false);
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [inviteError, setInviteError] = useState('');
    // Invite/search logic
    async function handleSearch() {
        setSearching(true);
        setInviteError('');
        setSearchResults([]);
        try {
            if (!search.trim()) throw new Error('Enter a username');
            const q = query(collection(db, 'users'), where('username', '>=', search.trim()), where('username', '<=', search.trim() + '\uf8ff'));
            const snap = await getDocs(q);
            // Only show users not already in memberIds
            const memberIds = (habit.memberIds || (habit.members || []).map(m => m.id) || []);
            const results = snap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(u => u.id !== userId && !memberIds.includes(u.id));
            setSearchResults(results);
            if (results.length === 0) setInviteError('No users found');
        } catch (e) {
            setInviteError(e.message || 'Search failed');
        }
        setSearching(false);
    }

    async function handleInvite(uid) {
        // Only allow max 2 members
        if ((habit.memberIds || (habit.members || []).map(m => m.id) || []).length >= 2) return;
        try {
            await useHabitStore.getState().inviteBuddy(habit.id, uid);
            setInviteModal(false);
            Alert.alert('Success', 'Buddy invited!');
        } catch (e) {
            Alert.alert('Error', e.message || 'Could not invite');
        }
    }

    useEffect(() => {
        let unsub = null;
        async function fetchInitialProofs() {
            setLoading(true);
            try {
                const q = query(
                    collection(db, `habits/${habit.id}/proofs`),
                    orderBy('timestamp', 'desc'),
                    limit(20)
                );
                const snap = await getDocs(q);
                setProofs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setLastDoc(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
                setHasMore(snap.docs.length === 20);
            } catch (err) {
                setError(err.message);
            }
            setLoading(false);
        }
        fetchInitialProofs();
        return () => { if (unsub) unsub(); };
    }, [habit.id]);

    async function fetchMoreProofs() {
        if (!lastDoc || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const q = query(
                collection(db, `habits/${habit.id}/proofs`),
                orderBy('timestamp', 'desc'),
                startAfter(lastDoc),
                limit(20)
            );
            const snap = await getDocs(q);
            setProofs(prev => [...prev, ...snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))]);
            setLastDoc(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : lastDoc);
            setHasMore(snap.docs.length === 20);
        } catch (err) {
            setError(err.message);
        }
        setLoadingMore(false);
    }

    useEffect(() => {
        return () => {
            if (nudgeTimeoutRef.current) {
                clearTimeout(nudgeTimeoutRef.current);
            }
        };
    }, []);

    // Get buddy IDs from member objects, excluding owner and current user
    const buddyIds = (habit.members || []).filter(m => m.id !== habit.ownerId && m.id !== userId).map(m => m.id);
    // Find current user's member object
    const myMember = (habit.members || []).find(m => m.id === userId);
    const myStreak = myMember?.streak ?? 0;
    const myBestStreak = myMember?.bestStreak ?? 0;
    const isWaitingForApproval = proofs[0] && proofs[0].status === 'pending' && proofs[0].submittedBy === userId;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <CustomHeader title={habit.name} onBack={() => navigation.goBack()} />
            <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 12 }}>
                <Text>Current Streak: {myStreak}</Text>
                <Text>Best Streak: {myBestStreak}</Text>
                <Text>Buddy ID(s): {buddyIds.length ? buddyIds.join(', ') : 'None'}</Text>
                {/* Invite Buddy Button if only 1 member */}
                {(habit.memberIds ? habit.memberIds.length : (habit.members || []).length) === 1 && (
                    <AppButton title="Invite Buddy" onPress={() => setInviteModal(true)} style={{ marginVertical: 12 }} />
                )}
                {/* Invite Modal */}
                <Modal visible={inviteModal} animationType="slide" transparent={true} onRequestClose={() => setInviteModal(false)}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%' }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>Invite Buddy</Text>
                            <TextInput
                                placeholder="Search username..."
                                value={search}
                                onChangeText={setSearch}
                                style={{ borderWidth: 1, borderColor: '#aaa', borderRadius: 8, padding: 8, marginBottom: 12 }}
                                autoCapitalize="none"
                            />
                            <Button title={searching ? 'Searching...' : 'Search'} onPress={handleSearch} disabled={searching} />
                            {inviteError ? <Text style={{ color: 'red', marginTop: 8 }}>{inviteError}</Text> : null}
                            <FlatList
                                data={searchResults}
                                keyExtractor={item => item.id}
                                renderItem={({ item }) => (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                                        <Text style={{ flex: 1, fontSize: 16 }}>{item.username || item.email}</Text>
                                        <Button title="Invite" onPress={() => handleInvite(item.id)} />
                                    </View>
                                )}
                                ListEmptyComponent={searchResults.length === 0 && !searching ? null : undefined}
                            />
                            <Button title="Close" onPress={() => setInviteModal(false)} color="#888" />
                        </View>
                    </View>
                </Modal>
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
                            // Send push notification to buddy with debug alerts
                            try {
                                const buddyId = buddyIds[0];
                                if (!buddyId) throw new Error('No buddy found');
                                const buddyPushToken = await getPushTokenForUser(buddyId);
                                if (!buddyPushToken) throw new Error('Buddy has no push token');
                                await sendPushNotification({
                                    to: buddyPushToken,
                                    title: 'Streak Buddy',
                                    body: `DO YOUR STREAK FOR: ${habit.name}!`,
                                    data: { habitId: habit.id },
                                });
                            } catch (err) {
                                Alert.alert('Nudge failed', err.message || 'Could not send notification');
                            }
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
                    onEndReached={fetchMoreProofs}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={loadingMore ? <ActivityIndicator /> : null}
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
                                    <FastImage
                                        source={{ uri: item.url, priority: FastImage.priority.normal }}
                                        style={{ width: 120, height: 120, borderRadius: 12, marginBottom: 6 }}
                                        resizeMode={FastImage.resizeMode.cover}
                                    />
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
                                <FastImage source={{ uri: selectedImage, priority: FastImage.priority.normal }} style={{ width: '90%', height: '70%', alignSelf: 'center' }} resizeMode={FastImage.resizeMode.contain} />
                            )}
                        </TouchableOpacity>
                    </View>
                </Modal>
            </View>
        </SafeAreaView>
    );
}
