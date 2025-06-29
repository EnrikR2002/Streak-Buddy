// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBaJnipVajyxPSAwG3sQyGqB-_Ur_81lYY",
    authDomain: "streak-buddy-a7123.firebaseapp.com",
    projectId: "streak-buddy-a7123",
    storageBucket: "streak-buddy-a7123.firebasestorage.app",
    messagingSenderId: "554272970049",
    appId: "1:554272970049:web:1c57a491329edb0f2fbdc0",
    measurementId: "G-03JHRZPQ22"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);