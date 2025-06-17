import { create } from 'zustand';

export const useHabitStore = create(set => ({
  habits: [],
  addHabit: (habit) => set(state => ({
    habits: [
      ...state.habits,
      {
        id: Date.now().toString(),
        name: habit.name,
        proofType: habit.proofType,
        streak: 0,
        submittedToday: false,
        approved: null, // null = pending, true = approved, false = rejected
      }
    ]
  })),
  submitProof: (id) => set(state => ({
    habits: state.habits.map(h => h.id === id ? { ...h, submittedToday: true, approved: null } : h)
  })),
  approveProof: (id) => set(state => ({
    habits: state.habits.map(h => h.id === id ? { ...h, approved: true, streak: h.streak + 1 } : h)
  })),
  rejectProof: (id) => set(state => ({
    habits: state.habits.map(h => h.id === id ? { ...h, approved: false, streak: 0 } : h)
  })),
  resetDay: () => set(state => ({
    habits: state.habits.map(h => (
      h.submittedToday && h.approved !== true
        ? { ...h, streak: 0, submittedToday: false, approved: null }
        : { ...h, submittedToday: false, approved: null }
    ))
  }))
}));

let lastResetDate = null;

export const checkAndResetDay = (resetDay) => {
  const today = new Date().toDateString();
  if (lastResetDate !== today) {
    resetDay();
    lastResetDate = today;
  }
};
