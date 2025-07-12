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
        projectId: Constants.expoConfig.extra?.eas?.projectId,
    })).data;
    if (userId && token) {
        await setDoc(doc(db, 'pushTokens', userId), { token }, { merge: true });
    }
    return token;
}

// Get push token for a user from Firestore
export async function getPushTokenForUser(userId) {
    if (!userId) {
        console.warn('Cannot get push token: userId is required');
        return null;
    }

    try {
        const docRef = doc(db, 'pushTokens', userId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data().token;
        }
        return null;
    } catch (error) {
        console.error('Error fetching push token:', error);
        return null;
    }
}

// Send a push notification via Expo
export async function sendPushNotification({ to, title, body, data }) {
    if (!to || !title || !body) {
        console.error('Push notification requires to, title, and body parameters');
        return { error: 'Missing required parameters' };
    }

    const message = {
        to,
        sound: 'default',
        title,
        body,
        data,
    };

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to send push notification:', error);
        return { error: error.message };
    }
}
