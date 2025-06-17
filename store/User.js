import { create } from 'zustand';

export const useUserStore = create(set => ({
    userId: null, // set after pairing
    buddyId: null,
    code: null,
    setUser: (userId, buddyId, code) => set({ userId, buddyId, code }),
}));
