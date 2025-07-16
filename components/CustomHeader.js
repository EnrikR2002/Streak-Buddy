import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export default function CustomHeader({ title, onBack, right, style }) {
    return (
        <SafeAreaView style={[{ backgroundColor: theme.background }, style]} edges={["top"]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: '#eee', backgroundColor: theme.background }}>
                {onBack ? (
                    <TouchableOpacity onPress={onBack} style={{ padding: 8, marginRight: 8 }}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                ) : null}
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.text, flex: 1 }}>{title}</Text>
                {right}
            </View>
        </SafeAreaView>
    );
}
