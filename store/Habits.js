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
    // Unsubscribe previous snapshot if exists
    if (get().unsubscribe) get().unsubscribe();
    const q = query(collection(db, 'habits'), where('members', 'array-contains', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const habits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      set({ habits });
    });
    set({ unsubscribe });
  },

  // Create a new habit with a code
  createHabitWithCode: async ({ name }) => {
    const userId = useUserStore.getState().userId;
    if (!userId) throw new Error('User ID not set');
    const code = generateCode();
    await addDoc(collection(db, 'habits'), {
      name,
      streak: 0,
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
    await updateDoc(proofDoc, { status: 'approved' });
  },

  // Reject proof (buddy action)
  rejectProof: async (habitId, proofId) => {
    const proofDoc = doc(db, `habits/${habitId}/proofs`, proofId);
    await updateDoc(proofDoc, { status: 'rejected' });
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
