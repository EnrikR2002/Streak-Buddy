import { create } from 'zustand';
import { db, storage } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, getDocs, getDoc, serverTimestamp, setDoc, orderBy, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { useUserStore } from './User';


export const useHabitStore = create((set, get) => ({
  habits: [],
  unsubscribe: null,

  // Load all habits for this user (owner or buddy)
  loadHabits: async () => {
    const userId = useUserStore.getState().userId;
    if (!userId) return;
    if (get().unsubscribe) get().unsubscribe();
    const q1 = query(collection(db, 'habits'), where('members', 'array-contains', userId));
    const q2 = query(collection(db, 'habits'), where('userId', '==', userId));
    let habits1 = [];
    let habits2 = [];
    // Helper to merge and update state
    const updateCombinedHabits = () => {
      const allHabits = [...habits1, ...habits2].filter((h, i, arr) => arr.findIndex(x => x.id === h.id) === i);
      set({ habits: allHabits });
      checkAndResetStreaks(allHabits);
    };
    // Set up both listeners independently
    const unsub1 = onSnapshot(q1, (snapshot1) => {
      habits1 = snapshot1.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          bestStreak: typeof data.bestStreak === 'number' ? data.bestStreak : 0,
          streak: typeof data.streak === 'number' ? data.streak : 0
        };
      });
      updateCombinedHabits();
    });
    const unsub2 = onSnapshot(q2, (snapshot2) => {
      habits2 = snapshot2.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          bestStreak: typeof data.bestStreak === 'number' ? data.bestStreak : 0,
          streak: typeof data.streak === 'number' ? data.streak : 0
        };
      });
      updateCombinedHabits();
    });
    set({ unsubscribe: () => { unsub1(); unsub2(); } });
  },

  // Add new habit
  addHabit: async ({ name }) => {
    const userId = useUserStore.getState().userId;
    if (!userId) throw new Error('User ID not set');
    await addDoc(collection(db, 'habits'), {
      name,
      streak: 0,
      bestStreak: 0,
      submittedToday: false,
      approved: null,
      created: Date.now(),
      members: [userId],
      ownerId: userId
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
    const proofDocRef = doc(db, `habits/${habitId}/proofs`, proofId);
    // Get proof data
    const proofSnap = await getDoc(proofDocRef);
    const proofData = proofSnap.exists() ? proofSnap.data() : null;
    if (!proofData) return;
    // Only approve if not already approved
    if (proofData.status !== 'approved') {
      await updateDoc(proofDocRef, { status: 'approved' });
      // Get habit
      const habitRef = doc(db, 'habits', habitId);
      const habitSnap = await getDoc(habitRef);
      const habit = habitSnap.exists() ? { id: habitSnap.id, ...habitSnap.data() } : null;
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
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();
  const batch = writeBatch(db);
  let hasUpdates = false;

  for (const habit of habits) {
    const proofsSnap = await getDocs(
      query(
        collection(db, `habits/${habit.id}/proofs`),
        orderBy('timestamp', 'desc')
      )
    );
    const proofs = proofsSnap.docs.map(d => d.data());
    const latestApproved = proofs.find(p => p.status === 'approved');
    let lastApprovedDate = latestApproved &&
      latestApproved.timestamp &&
      latestApproved.timestamp.toDate
      ? latestApproved.timestamp.toDate().toDateString()
      : null;

    // Only reset if last approved is not today or yesterday (i.e., missed a full day)
    if (
      lastApprovedDate !== todayStr &&
      lastApprovedDate !== yesterdayStr &&
      habit.streak > 0
    ) {
      batch.update(doc(db, 'habits', habit.id), { streak: 0 });
      hasUpdates = true;
    }
  }

  if (hasUpdates) {
    await batch.commit();
  }
}