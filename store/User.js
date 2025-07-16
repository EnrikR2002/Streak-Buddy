import { create } from 'zustand';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

export const useUserStore = create(set => ({
    userId: null,
    setUserId: (userId) => set({ userId }),
}));

// Sync userId with Firebase Auth UID
export function useSyncUserIdWithAuth() {
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            useUserStore.getState().setUserId(user ? user.uid : null);
        });
        return unsubscribe;
    }, []);
}
