import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export function useFirebaseAuthUser() {
    const [user, setUser] = useState(null);
    useEffect(() => {
        const auth = getAuth();
        const unsub = onAuthStateChanged(auth, setUser);
        return unsub;
    }, []);
    return user;
}
