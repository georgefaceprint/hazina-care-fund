import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from './firebase';

export const storage = getStorage(app);

export const uploadProfilePhoto = async (userId, file) => {
    if (!file) return null;
    
    // Create a reference to 'users/{userId}/profile.jpg'
    const fileExtension = file.name.split('.').pop();
    const storageRef = ref(storage, `users/${userId}/identity_docs/id_front_${Date.now()}.${fileExtension}`);
    
    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading photo:", error);
        throw error;
    }
};
