import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../store/User';
import { useHabitStore } from '../store/Habits';
import { doc, getDoc, collection, query, where, onSnapshot, collectionGroup, orderBy } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { theme } from '../theme';
import AppButton from '../components/AppButton';
import CustomHeader from '../components/CustomHeader';
import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen({ navigation }) {
    const userId = useUserStore(s => s.userId);
    const [habits, setHabits] = useState([]);
    const [invites, setInvites] = useState([]);
    const [proofs, setProofs] = useState({}); // { habitId: [proofs] }
    const [profilePic, setProfilePic] = useState(null);
    const [combinedList, setCombinedList] = useState([]);

    // Always fetch latest profilePic when HomeScreen is focused or userId changes
    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            async function fetchProfilePic() {
                if (!userId) return;
                try {
                    const snap = await getDoc(doc(db, 'users', userId));
                    if (snap.exists() && isActive) {
                        const data = snap.data();
                        setProfilePic(data.profilePic);
                    }
                } catch (e) {
                    console.error('[HomeScreen] Error fetching profilePic:', e);
                }
            }
            fetchProfilePic();
            return () => { isActive = false; };
        }, [userId])
    );

    useEffect(() => {
        // Fetch habits where I'm a member
        const q1 = query(
            collection(db, 'habits'),
            where('memberIds', 'array-contains', userId)
        );
        // Store proof unsubscribers so we can clean them up
        let proofUnsubs = [];

        const unsub1 = onSnapshot(
            q1,
            snap => {
                const loadedHabits = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setHabits(loadedHabits);

                // Clean up previous proof listeners
                proofUnsubs.forEach(u => u && u());
                proofUnsubs = [];

                // Set up proof listeners for current habits
                loadedHabits.forEach(habit => {
                    const q = query(collection(db, `habits/${habit.id}/proofs`), orderBy('timestamp', 'desc'));
                    const unsub = onSnapshot(
                        q,
                        snap => {
                            setProofs(prev => ({ ...prev, [habit.id]: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }));
                        },
                        error => {
                            console.error(`[HomeScreen] Error in proofs listener for habitId ${habit.id}:`, error);
                        }
                    );
                    proofUnsubs.push(unsub);
                });
            },
            error => {
                console.error('[HomeScreen] Error in habits listener:', error);
            }
        );

        // Fetch invites where I'm the invitee (pending only)
        const q2 = query(
            collectionGroup(db, 'invites'),
            where('invitee', '==', userId),
            where('status', '==', 'pending')
        );
        const unsub2 = onSnapshot(
            q2,
            snap => {
                setInvites(
                    snap.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            habitId: doc.ref.parent.parent.id,
                            habitName: data.habitName || '',
                            invitedBy: data.invitedBy || '',
                            ...data
                        };
                    })
                );
            },
            error => {
                console.error('[HomeScreen] Error in invites listener:', error);
            }
        );

        return () => {
            unsub1();
            unsub2();
            proofUnsubs.forEach(u => u && u());
        };
    }, [userId]);

    // Combine habits and invites into a single list
    useEffect(() => {
        // Habits you are a member of
        const habitItems = habits.map(h => ({ type: 'habit', ...h }));
        // Pending invites
        const inviteItems = invites.map(inv => ({
            type: 'invite',
            id: inv.id,
            habitId: inv.habitId,
            habitName: inv.habitName,
            invitedBy: inv.invitedBy
        }));
        setCombinedList([...inviteItems, ...habitItems]);
    }, [habits, invites]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <CustomHeader title="Streak Buddy" right={
                <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={{ marginRight: 4 }}>
                    <FastImage
                        source={
                            !profilePic || profilePic === 'default'
                                ? require('../assets/defaultBuddy.png')
                                : { uri: profilePic, priority: FastImage.priority.normal }
                        }
                        style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' }}
                        resizeMode={FastImage.resizeMode.cover}
                    />
                </TouchableOpacity>
            } />
            <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 12 }}>
                <AppButton title="Add Habit" onPress={() => navigation.navigate('AddHabit')} style={{ marginBottom: 10 }} />
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: theme.text, marginVertical: 10, alignSelf: 'center' }}>Your Habits & Invites</Text>
                <FlatList
                    data={combinedList}
                    keyExtractor={item => item.type === 'invite' ? `invite-${item.id}` : item.id}
                    ListEmptyComponent={<Text>No habits or invites yet. Add one!</Text>}
                    renderItem={({ item }) => {
                        if (item.type === 'invite') {
                            // ...existing code for invites...
                            return (
                                <View style={{ backgroundColor: theme.card, borderRadius: theme.borderRadius, padding: 16, marginVertical: 10, ...theme.shadow, alignItems: 'center', borderColor: theme.accent, borderWidth: 2 }}>
                                    <Text style={{ fontSize: 18, fontWeight: '600', textAlign: 'center' }}>Invited to join: {item.habitName}</Text>
                                    <Text style={{ color: '#888', marginBottom: 8 }}>Invited by: {item.invitedBy}</Text>
                                    <View style={{ flexDirection: 'row', marginTop: 8, justifyContent: 'center', width: '100%' }}>
                                        <AppButton title="Accept" onPress={async () => {
                                            console.log('Accept pressed for invite:', item);
                                            try {
                                                await useHabitStore.getState().respondToInvite(item.habitId, item.id, 'accepted');
                                                console.log('respondToInvite completed for:', item.habitId, item.id);
                                                setInvites(prev => prev.filter(i => i.id !== item.id));
                                            } catch (e) {
                                                console.error('Error in respondToInvite:', e);
                                            }
                                        }} style={{ flex: 1, marginRight: 6, backgroundColor: theme.primary }} />
                                        <AppButton title="Reject" onPress={async () => {
                                            await useHabitStore.getState().respondToInvite(item.habitId, item.id, 'rejected');
                                            setInvites(prev => prev.filter(i => i.id !== item.id));
                                        }} style={{ flex: 1, marginLeft: 6, backgroundColor: '#FF7096' }} />
                                    </View>
                                </View>
                            );
                        } else {
                            // ...existing habit rendering code...
                            const habitProofs = proofs[item.id] || [];
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
                            const latestProof = todaysProof || null;
                            const myMember = item.members?.find(m => m.id === userId);
                            return (
                                <TouchableOpacity onPress={() => navigation.navigate('HabitDetails', { habit: item })}>
                                    <View style={{ backgroundColor: theme.card, borderRadius: theme.borderRadius, padding: 16, marginVertical: 10, ...theme.shadow, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 18, fontWeight: '600', textAlign: 'center' }}>{item.name}</Text>
                                        {latestProof ? (
                                            <>
                                                <Text style={{ textAlign: 'center' }}>Status: {latestProof.status}</Text>
                                                <Image source={{ uri: latestProof.url }} style={{ width: 120, height: 120, marginVertical: 8, borderRadius: 8, alignSelf: 'center' }} />
                                                <Text style={{ textAlign: 'center' }}>Submitted by: {latestProof.submittedBy === userId ? 'You' : 'Buddy'}</Text>
                                                {latestProof.status === 'pending' && userId !== latestProof.submittedBy && (
                                                    <View style={{ flexDirection: 'row', marginTop: 8, justifyContent: 'center', width: '100%' }}>
                                                        <AppButton title="Approve" onPress={async () => {
                                                            await useHabitStore.getState().approveProof(item.id, latestProof.id);
                                                        }} style={{ flex: 1, marginRight: 6 }} />
                                                        <AppButton title="Reject" onPress={async () => {
                                                            await useHabitStore.getState().rejectProof(item.id, latestProof.id);
                                                        }} style={{ flex: 1, marginLeft: 6, backgroundColor: '#FF7096' }} />
                                                    </View>
                                                )}
                                                {latestProof.status === 'pending' && latestProof.submittedBy === userId && (
                                                    <Text style={{ color: '#888', marginTop: 8, textAlign: 'center' }}>Waiting for buddy to approve...</Text>
                                                )}
                                                {latestProof.status === 'approved' && latestProof.submittedBy === userId && (
                                                    <Text style={{ color: 'green', marginTop: 8, textAlign: 'center' }}>Proof approved! Current Streak: {myMember?.streak ?? 0}</Text>
                                                )}
                                                {latestProof.status === 'approved' && latestProof.submittedBy !== userId && (
                                                    // If user hasn't submitted their own proof today, show Submit Proof button
                                                    myMember?.submittedToday
                                                        ? (<Text style={{ color: 'green', marginTop: 8, textAlign: 'center' }}>Buddy's proof approved!</Text>)
                                                        : (<AppButton title="Submit Proof" onPress={() => navigation.navigate('AddHabit', { id: item.id })} />)
                                                )}
                                                {latestProof.status === 'rejected' && (
                                                    <Text style={{ color: 'red', marginTop: 8, textAlign: 'center' }}>Proof rejected.</Text>
                                                )}
                                            </>
                                        ) : (
                                            item.members && item.members.length === 1 ? (
                                                <AppButton title="Invite Buddy" onPress={() => navigation.navigate('HabitDetails', { habit: item, showInvite: true })} />
                                            ) : (
                                                // Only show Submit Proof if user has not submitted today
                                                (() => {
                                                    if (myMember?.submittedToday) {
                                                        // Show approved/rejected status if available
                                                        if (myMember?.approved === true) {
                                                            return <Text style={{ color: 'green', marginTop: 8, textAlign: 'center' }}>Proof approved! Current Streak: {myMember?.streak ?? 0}</Text>;
                                                        } else if (myMember?.approved === false) {
                                                            return <Text style={{ color: 'red', marginTop: 8, textAlign: 'center' }}>Proof rejected.</Text>;
                                                        }
                                                        return <Text style={{ color: '#888', marginTop: 8, textAlign: 'center' }}>You already submitted today.</Text>;
                                                    }
                                                    return <AppButton title="Submit Proof" onPress={() => navigation.navigate('AddHabit', { id: item.id })} />;
                                                })()
                                            )
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        }
                    }}
                />
            </View>
        </SafeAreaView>
    );
}
