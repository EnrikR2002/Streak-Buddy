import React from 'react';
import { View, Text, Button } from 'react-native';

export default function PairScreen({ navigation }) {
  // For MVP: instantly navigate to Home (simulate pairing)
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Pair with Buddy (MVP: Skipped)</Text>
      <Button title="Continue" onPress={() => navigation.replace('Home')} />
    </View>
  );
}
