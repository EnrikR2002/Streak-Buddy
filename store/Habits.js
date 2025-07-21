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
    // Use memberIds for querying habits where user is a member
    const q1 = query(collection(db, 'habits'), where('memberIds', 'array-contains', userId));
    // Also load habits where user is the owner
    const q2 = query(collection(db, 'habits'), where('ownerId', '==', userId));
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
          ...data
        };
      });
      updateCombinedHabits();
    });
    const unsub2 = onSnapshot(q2, (snapshot2) => {
      habits2 = snapshot2.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        };
      });
      updateCombinedHabits();
    });
    set({ unsubscribe: () => { unsub1(); unsub2(); } });
  },

  // Add new habit (with new members array of objects and memberIds array)
  addHabit: async ({ name }) => {
    const userId = useUserStore.getState().userId;
    if (!userId) throw new Error('User ID not set');
    await addDoc(collection(db, 'habits'), {
      name,
      createdAt: new Date(),
      ownerId: userId,
      members: [
        {
          id: userId,
          streak: 0,
          bestStreak: 0,
          submittedToday: false,
          approved: false
        }
      ],
      memberIds: [userId]
    });
  },

  // Helper: update a member's field in a habit and keep memberIds in sync
  updateMemberField: async (habitId, memberId, updates) => {
    const habitRef = doc(db, 'habits', habitId);
    const habitSnap = await getDoc(habitRef);
    if (!habitSnap.exists()) throw new Error('Habit not found');
    const habit = habitSnap.data();
    let members = (habit.members || []).map(m =>
      m.id === memberId ? { ...m, ...updates } : m
    );
    // Ensure memberIds matches members
    let memberIds = members.map(m => m.id);
    await updateDoc(habitRef, { members, memberIds });
  },

  // Invite buddy: create a pending invite in invites subcollection
  inviteBuddy: async (habitId, inviteeId) => {
    const userId = useUserStore.getState().userId;
    if (!userId) throw new Error('User ID not set');
    const habitRef = doc(db, 'habits', habitId);
    const habitSnap = await getDoc(habitRef);
    if (!habitSnap.exists()) throw new Error('Habit not found');
    const habit = habitSnap.data();
    // Don't invite if already present or already invited
    if ((habit.memberIds || []).includes(inviteeId)) return;
    // Check for existing pending invite
    const invitesSnap = await getDocs(collection(db, `habits/${habitId}/invites`));
    const alreadyInvited = invitesSnap.docs.some(doc => {
      const data = doc.data();
      return data.invitee === inviteeId && data.status === 'pending';
    });
    if (alreadyInvited) return;
    // Create invite doc
    const inviteId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    await setDoc(doc(db, `habits/${habitId}/invites`, inviteId), {
      status: 'pending',
      invitedBy: userId,
      invitee: inviteeId,
      inviteId,
      timestamp: serverTimestamp()
    });
  },

  // Submit proof (photo): compress, upload to storage, then create Firestore doc and update member's submittedToday
  submitProof: async (habitId, imageUri) => {
    const userId = useUserStore.getState().userId;
    if (!userId) throw new Error('User ID not set');
    // Check if user already submitted today
    const habitRef = doc(db, 'habits', habitId);
    const habitSnap = await getDoc(habitRef);
    if (!habitSnap.exists()) throw new Error('Habit not found');
    const habit = habitSnap.data();
    const myMember = (habit.members || []).find(m => m.id === userId);
    if (myMember?.submittedToday) throw new Error('You have already submitted a proof today.');

    const submissionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    // Compress and resize image before upload
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 800 } }],
      { compress: 0.25, format: ImageManipulator.SaveFormat.JPEG }
    );
    const response = await fetch(manipResult.uri);
    const blob = await response.blob();
    const storageRef = ref(storage, `habits/${habitId}/proofs/${submissionId}.jpg`);
    await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(storageRef);
    await setDoc(doc(db, `habits/${habitId}/proofs`, submissionId), {
      status: 'pending',
      submissionId,
      submittedBy: userId,
      timestamp: serverTimestamp(),
      url
    });
    // Mark member as submittedToday: true, approved: false
    await get().updateMemberField(habitId, userId, { submittedToday: true, approved: false });
  },
  // Accept or reject an invite
  respondToInvite: async (habitId, inviteId, action) => {
    // action: 'accepted' or 'rejected'
    const userId = useUserStore.getState().userId;
    console.log('respondToInvite called:', { habitId, inviteId, action, userId });
    if (!userId) throw new Error('User ID not set');
    const inviteRef = doc(db, `habits/${habitId}/invites`, inviteId);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) {
      console.error('Invite not found:', habitId, inviteId);
      throw new Error('Invite not found');
    }
    const invite = inviteSnap.data();
    console.log('Invite data:', invite);
    if (invite.status !== 'pending') {
      console.log('Invite not pending:', invite.status);
      return;
    }
    // Update invite status
    await updateDoc(inviteRef, { status: action });
    console.log('Invite status updated:', action);
    if (action === 'accepted') {
      // Add member to habit
      const habitRef = doc(db, 'habits', habitId);
      const habitSnap = await getDoc(habitRef);
      if (!habitSnap.exists()) {
        console.error('Habit not found:', habitId);
        throw new Error('Habit not found');
      }
      const habit = habitSnap.data();
      console.log('Habit before update:', habit);
      if ((habit.memberIds || []).includes(userId)) {
        console.log('User already in memberIds:', userId);
        return;
      }
      const newMember = {
        id: userId,
        streak: 0,
        bestStreak: 0,
        submittedToday: false,
        approved: false
      };
      const members = [...(habit.members || []), newMember];
      const memberIds = [...(habit.memberIds || []), userId];
      await updateDoc(habitRef, { members, memberIds });
      console.log('Habit updated with new member:', userId);
    }
  },


  // Approve proof (buddy action, per member)
  approveProof: async (habitId, proofId) => {
    const proofDocRef = doc(db, `habits/${habitId}/proofs`, proofId);
    // Get proof data
    const proofSnap = await getDoc(proofDocRef);
    const proofData = proofSnap.exists() ? proofSnap.data() : null;
    if (!proofData) return;
    // Only approve if not already approved
    if (proofData.status !== 'approved') {
      await updateDoc(proofDocRef, { status: 'approved' });
      // Update member's approved, streak, bestStreak
      const habitRef = doc(db, 'habits', habitId);
      const habitSnap = await getDoc(habitRef);
      if (!habitSnap.exists()) return;
      const habit = habitSnap.data();
      const memberId = proofData.submittedBy;
      const today = new Date().toDateString();
      let members = (habit.members || []).map(m => {
        if (m.id === memberId) {
          // Only increment streak if proof is for today
          let proofDate = proofData.timestamp && proofData.timestamp.toDate ? proofData.timestamp.toDate().toDateString() : null;
          let newStreak = m.streak;
          let bestStreak = m.bestStreak;
          if (proofDate === today) {
            newStreak = (m.streak || 0) + 1;
            if (newStreak > (m.bestStreak || 0)) bestStreak = newStreak;
          }
          return { ...m, approved: true, streak: newStreak, bestStreak };
        }
        return m;
      });
      // Ensure memberIds stays in sync
      let memberIds = members.map(m => m.id);
      await updateDoc(habitRef, { members, memberIds });
    }
  },


  // Reject proof (buddy action, per member)
  rejectProof: async (habitId, proofId) => {
    const proofDoc = doc(db, `habits/${habitId}/proofs`, proofId);
    await updateDoc(proofDoc, { status: 'rejected' });
    // Set member's approved to false, reset streak to 0
    const proofSnap = await getDoc(proofDoc);
    const proofData = proofSnap.exists() ? proofSnap.data() : null;
    if (!proofData) return;
    const memberId = proofData.submittedBy;
    await get().updateMemberField(habitId, memberId, { approved: false, streak: 0 });
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
    // If lastReset is not today, reset submittedToday and approved for all members
    if (habit.lastReset !== today) {
      let members = (habit.members || []).map(m => ({
        ...m,
        submittedToday: false,
        approved: null
      }));
      let memberIds = members.map(m => m.id);
      await updateDoc(doc(db, 'habits', docSnap.id), {
        members,
        memberIds,
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