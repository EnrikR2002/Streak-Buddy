import { create } from 'zustand';
import { db, storage } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { useUserStore } from './User';

// Generate a random 6-character code
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const useHabitStore = create((set, get) => ({
  habits: [],
  unsubscribe: null,

  // Load all habits for this user (owner or buddy)
  loadHabits: async () => {
    const userId = useUserStore.getState().userId;
    if (!userId) return;
    if (get().unsubscribe) get().unsubscribe();
    // Query for both new and old habits
    const q1 = query(collection(db, 'habits'), where('members', 'array-contains', userId));
    const q2 = query(collection(db, 'habits'), where('userId', '==', userId));
    // Listen to both queries synchronously
    const unsub1 = onSnapshot(q1, (snapshot1) => {
      const habits1 = snapshot1.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          bestStreak: typeof data.bestStreak === 'number' ? data.bestStreak : 0,
          streak: typeof data.streak === 'number' ? data.streak : 0
        };
      });
      const unsub2 = onSnapshot(q2, (snapshot2) => {
        const habits2 = snapshot2.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            bestStreak: typeof data.bestStreak === 'number' ? data.bestStreak : 0,
            streak: typeof data.streak === 'number' ? data.streak : 0
          };
        });
        // Merge and deduplicate by id
        const allHabits = [...habits1, ...habits2].filter((h, i, arr) => arr.findIndex(x => x.id === h.id) === i);
        set({ habits: allHabits });
        // Run daily reset after habits are loaded
        checkAndResetStreaks(allHabits);
      });
      set({ unsubscribe: () => { unsub1(); unsub2(); } });
    });
  },

  // Create a new habit with a code
  createHabitWithCode: async ({ name }) => {
    const userId = useUserStore.getState().userId;
    if (!userId) throw new Error('User ID not set');
    const code = generateCode();
    await addDoc(collection(db, 'habits'), {
      name,
      streak: 0,
      bestStreak: 0,
      submittedToday: false,
      approved: null,
      created: Date.now(),
      code,
      members: [userId],
      ownerId: userId
    });
    return code;
  },

  // Join an existing habit by code
  joinHabitByCode: async (code) => {
    const userId = useUserStore.getState().userId;
    if (!userId) throw new Error('User ID not set');
    const q = query(collection(db, 'habits'), where('code', '==', code.toUpperCase()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) throw new Error('No habit found with that code');
    const docRef = snapshot.docs[0].ref;
    const habit = snapshot.docs[0].data();
    if (habit.members && habit.members.includes(userId)) throw new Error('Already joined');
    await updateDoc(docRef, {
      members: habit.members ? [...habit.members, userId] : [userId]
    });
  },

  // Add new habit
  addHabit: async ({ name }) => {
    const userId = useUserStore.getState().userId;
    await addDoc(collection(db, 'habits'), {
      userId,
      name,
      streak: 0,
      bestStreak: 0,
      submittedToday: false,
      approved: null,
      created: Date.now()
    });
  },

  // Submit proof (photo): compress, upload to storage, then create Firestore doc
  submitProof: async (habitId, imageUri) => {
    const userId = useUserStore.getState().userId;
    if (!userId) throw new Error('User ID not set');
    const submissionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    // Compress and resize image before upload
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 800 } }], // Resize to max width 800px (height auto)
      { compress: 0.25, format: ImageManipulator.SaveFormat.JPEG }
    );
    const response = await fetch(manipResult.uri);
    const blob = await response.blob();
    const storageRef = ref(storage, `habits/${habitId}/proofs/${submissionId}.jpg`);
    await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(storageRef);
    await setDoc(doc(db, `habits/${habitId}/proofs`, submissionId), {
      url,
      timestamp: serverTimestamp(),
      submittedBy: userId,
      status: 'pending',
      submissionId
    });
  },

  // Approve proof (buddy action)
  approveProof: async (habitId, proofId) => {
    const proofDoc = doc(db, `habits/${habitId}/proofs`, proofId);
    // Get proof data
    const proofSnap = await getDocs(query(collection(db, `habits/${habitId}/proofs`), where('submissionId', '==', proofId)));
    let proofData = null;
    proofSnap.forEach(doc => { proofData = doc.data(); });
    if (!proofData) return;
    // Only approve if not already approved
    if (proofData.status !== 'approved') {
      await updateDoc(proofDoc, { status: 'approved' });
      // Get habit
      const habitRef = doc(db, 'habits', habitId);
      const habitSnap = await getDocs(query(collection(db, 'habits'), where('__name__', '==', habitId)));
      let habit = null;
      habitSnap.forEach(doc => { habit = { id: doc.id, ...doc.data() }; });
      if (!habit) return;
      // Check if proof is for today
      let proofDate = proofData.timestamp && proofData.timestamp.toDate ? proofData.timestamp.toDate().toDateString() : null;
      const today = new Date().toDateString();
      if (proofDate === today) {
        let newStreak = (habit.streak || 0) + 1;
        let bestStreak = habit.bestStreak || 0;
        if (newStreak > bestStreak) bestStreak = newStreak;
        await updateDoc(habitRef, { streak: newStreak, bestStreak });
      }
    }
  },

  // Reject proof (buddy action)
  rejectProof: async (habitId, proofId) => {
    const proofDoc = doc(db, `habits/${habitId}/proofs`, proofId);
    await updateDoc(proofDoc, { status: 'rejected' });
    // Reset streak to 0
    const habitRef = doc(db, 'habits', habitId);
    await updateDoc(habitRef, { streak: 0 });
  },
}));

// Daily reset: sets submittedToday and approved to false/null for all habits if a new day has started
export async function checkAndResetDay() {
  const userId = useUserStore.getState().userId;
  if (!userId) return;

  // Get all habits for this user
  const q = query(collection(db, 'habits'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const today = new Date().toDateString();

  for (const docSnap of snapshot.docs) {
    const habit = docSnap.data();
    // If lastReset is not today, reset submittedToday and approved
    if (habit.lastReset !== today) {
      await updateDoc(doc(db, 'habits', docSnap.id), {
        submittedToday: false,
        approved: null,
        lastReset: today
      });
    }
  }
}

// Helper to check and reset streaks for loaded habits
async function checkAndResetStreaks(habits) {
  const today = new Date().toDateString();
  for (const habit of habits) {
    const proofsSnap = await getDocs(query(collection(db, `habits/${habit.id}/proofs`), orderBy('timestamp', 'desc')));
    const proofs = proofsSnap.docs.map(d => d.data());
    const latestApproved = proofs.find(p => p.status === 'approved');
    let lastApprovedDate = latestApproved && latestApproved.timestamp && latestApproved.timestamp.toDate ? latestApproved.timestamp.toDate().toDateString() : null;
    if (lastApprovedDate !== today && habit.streak > 0) {
      await updateDoc(doc(db, 'habits', habit.id), { streak: 0 });
    }
  }
}
