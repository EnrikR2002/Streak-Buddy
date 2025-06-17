import React from 'react';
import { View, Text, Button, FlatList, TouchableOpacity } from 'react-native';
import { useHabitStore, checkAndResetDay } from '../store/Habits';

export default function HomeScreen({ navigation }) {
    const habits = useHabitStore(s => s.habits);
    const approveProof = useHabitStore(s => s.approveProof);
    const rejectProof = useHabitStore(s => s.rejectProof);

    const resetDay = useHabitStore(s => s.resetDay);

    React.useEffect(() => {
        checkAndResetDay(resetDay);
    }, []);

    return (
        <View style={{ flex: 1, padding: 24 }}>
            <Button title="Add Habit" onPress={() => navigation.navigate('AddHabit')} />
            <Text style={{ fontSize: 22, fontWeight: 'bold', marginVertical: 16 }}>Your Habits</Text>
            <FlatList
                data={habits}
                keyExtractor={item => item.id}
                ListEmptyComponent={<Text>No habits yet. Add one!</Text>}
                renderItem={({ item }) => (
                    <View style={{
                        borderWidth: 1, borderColor: '#aaa', padding: 12, marginBottom: 12, borderRadius: 8,
                        backgroundColor: item.approved === true ? '#d4ffd4'
                            : item.approved === false ? '#ffd4d4'
                                : '#fff'
                    }}>
                        <Text style={{ fontSize: 18, fontWeight: '600' }}>{item.name}</Text>
                        <Text>Proof: {item.proofType}</Text>
                        <Text>Streak: {item.streak}</Text>
                        <Text>Status: {
                            item.approved === true ? "Approved"
                                : item.approved === false ? "Rejected"
                                    : item.submittedToday ? "Pending" : "Not Submitted"
                        }</Text>
                        {item.submittedToday && item.approved === null && (
                            <View style={{ flexDirection: 'row', marginTop: 8 }}>
                                <TouchableOpacity onPress={() => approveProof(item.id)} style={{ marginRight: 12 }}>
                                    <Text style={{ color: 'green', fontWeight: 'bold' }}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => rejectProof(item.id)}>
                                    <Text style={{ color: 'red', fontWeight: 'bold' }}>Reject</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => alert('Buddy nudged! (MVP)')}
                                    style={{ marginTop: 6, backgroundColor: '#ffd700', padding: 6, borderRadius: 5, alignSelf: 'flex-start' }}
                                >
                                    <Text style={{ color: '#222', fontWeight: 'bold' }}>Nudge Buddy</Text>
                                </TouchableOpacity>

                            </View>
                        )}
                        {!item.submittedToday && (
                            <Button title="Submit Proof" onPress={() => navigation.navigate('AddHabit', { id: item.id })} />
                        )}
                    </View>
                )}
            />
        </View>
    );
}
