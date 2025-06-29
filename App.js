import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './screens/HomeScreen';
import AddHabitScreen from './screens/AddHabitScreen';
import HabitDetailsScreen from './screens/HabitDetailsScreen';
import { useEnsureUserIdOnMount } from './store/User';

const Stack = createNativeStackNavigator();

export default function App() {
  useEnsureUserIdOnMount();
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="AddHabit" component={AddHabitScreen} />
        <Stack.Screen name="HabitDetails" component={HabitDetailsScreen} options={{ title: 'Habit Details' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}