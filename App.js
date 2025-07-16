import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './screens/HomeScreen';
import AddHabitScreen from './screens/AddHabitScreen';
import HabitDetailsScreen from './screens/HabitDetailsScreen';
import ProfileScreen from './screens/ProfileScreen';
import LoginScreen from './screens/LoginScreen';
import { useFirebaseAuthUser } from './store/Auth';
import { useSyncUserIdWithAuth } from './store/User';
import { registerForPushNotificationsAsync } from './utils/push';

const Stack = createNativeStackNavigator();

export default function App() {
  useSyncUserIdWithAuth();
  const user = useFirebaseAuthUser();
  useEffect(() => {
    if (user?.uid) {
      registerForPushNotificationsAsync(user.uid);
    }
  }, [user?.uid]);
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AddHabit" component={AddHabitScreen} options={{ headerShown: false }} />
            <Stack.Screen name="HabitDetails" component={HabitDetailsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}