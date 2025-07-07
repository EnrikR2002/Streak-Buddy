import * as Notifications from 'expo-notifications';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import Constants from 'expo-constants';

// Register for push notifications and save token to Firestore
export async function registerForPushNotificationsAsync(userId) {
    let token;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') {
        return null;
    }
    token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig.extra.FIREBASE_PROJECT_ID,
    })).data;
    if (userId && token) {
        await setDoc(doc(db, 'pushTokens', userId), { token }, { merge: true });
    }
    return token;
}

// Get a user's push token from Firestore
export async function getPushTokenForUser(userId) {
    const docRef = doc(db, 'pushTokens', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return snap.data().token;
    }
    return null;
}

// Send a push notification via Expo
export async function sendPushNotification({ to, title, body, data }) {
    const message = {
        to,
        sound: 'default',
        title,
        body,
        data,
    };
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
    });
    return response.json();
}
