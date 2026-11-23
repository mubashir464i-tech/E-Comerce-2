import { firebaseConfig } from './config/firebase_config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {
    createUserWithEmailAndPassword,
    getAuth,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const form = document.getElementById('signupForm');
const submitButton = document.getElementById('signupButton');
const message = document.getElementById('authMessage');

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';

    const name = form.elements.name.value.trim();
    const confirmName = form.elements.confirmName.value.trim();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const contactNo = form.elements.number.value.trim();
    const picture = form.elements.picture.files[0];

    if (name.toLocaleLowerCase() !== confirmName.toLocaleLowerCase()) {
        message.textContent = 'Name aur confirm name match nahi karte.';
        return;
    }
    if (!picture || !picture.type.startsWith('image/')) {
        message.textContent = 'Please ek image picture select karein.';
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Creating account…';

    try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const pictureRef = ref(storage, `user-images/${credential.user.uid}/${Date.now()}-${picture.name}`);
        await uploadBytes(pictureRef, picture, { contentType: picture.type });
        const imageUrl = await getDownloadURL(pictureRef);

        await updateProfile(credential.user, { displayName: name, photoURL: imageUrl });
        await setDoc(doc(db, 'users', credential.user.uid), {
            userKey: credential.user.uid,
            email,
            name,
            contactNo,
            imageUrl,
            createdAt: serverTimestamp()
        });

        window.location.replace('./admin.html');
    } catch (error) {
        const messages = {
            'auth/email-already-in-use': 'Is email se pehle hi account bana hua hai.',
            'auth/invalid-email': 'Email address check karein.',
            'auth/weak-password': 'Password kam az kam 6 characters ka hona chahiye.',
            'storage/unauthorized': 'Picture upload ki permission nahi mili. Firebase Storage rules check karein.'
        };
        message.textContent = messages[error.code] || error.message || 'Account nahi bana. Dobara try karein.';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Create Account';
    }
});
