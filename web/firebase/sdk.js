export { initializeApp } from 'firebase/app';
export { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser, connectAuthEmulator } from 'firebase/auth';
export { getFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc, addDoc, query, where, runTransaction, writeBatch, connectFirestoreEmulator } from 'firebase/firestore';
export { getStorage, ref, uploadBytes, getBlob, deleteObject, connectStorageEmulator } from 'firebase/storage';
