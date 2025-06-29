import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';

function generateRandomId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export const useUserStore = create(set => ({
    userId: null,
    setUserId: (userId) => set({ userId }),
}));

// Persist and load userId on app start
export async function ensureUserId() {
    let userId = await SecureStore.getItemAsync('userId');
    if (!userId) {
        userId = generateRandomId();
        await SecureStore.setItemAsync('userId', userId);
    }
    useUserStore.getState().setUserId(userId);
}

// Call this in your App.js or HomeScreen.js (top-level component)
export function useEnsureUserIdOnMount() {
    useEffect(() => {
        ensureUserId();
    }, []);
}
