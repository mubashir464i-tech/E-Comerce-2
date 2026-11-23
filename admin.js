import { firebaseConfig } from './config/firebase_config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const logoutButton = document.getElementById('logoutButton');
const profileForm = document.getElementById('profileForm');
const statusMessage = document.getElementById('pageMessage');
const pictureInput = document.getElementById('pictureInput');
const saveButton = document.getElementById('saveProfileButton');

let signedInUser = null;
let currentProfile = {};
let previewUrl = null;

function setMessage(text, isSuccess = false) {
    if (!statusMessage) return;
    statusMessage.textContent = text;
    statusMessage.classList.toggle('success', isSuccess);
}

function initials(name, email) {
    const source = (name || email || 'U').trim();
    return source.charAt(0).toUpperCase() || 'U';
}

function showAvatar(imageId, fallbackId, imageUrl, name, email) {
    const image = document.getElementById(imageId);
    const fallback = document.getElementById(fallbackId);
    if (!image || !fallback) return;

    fallback.textContent = initials(name, email);
    if (imageUrl) {
        image.src = imageUrl;
        image.hidden = false;
        fallback.hidden = true;
        image.onerror = () => {
            image.hidden = true;
            fallback.hidden = false;
        };
    } else {
        image.removeAttribute('src');
        image.hidden = true;
        fallback.hidden = false;
    }
}

function renderProfile(user, profile) {
    const name = profile.name || user.displayName || 'My profile';
    const email = user.email || profile.email || '';
    const number = profile.contactNo || '';
    const imageUrl = profile.imageUrl || user.photoURL || '';

    const headerName = document.getElementById('headerName');
    if (headerName) headerName.textContent = name;

    showAvatar('headerAvatar', 'headerFallback', imageUrl, name, email);
    showAvatar('profileImage', 'profileFallback', imageUrl, name, email);

    const textValues = {
        profileName: name,
        profileEmail: email,
        profileNameDetail: name,
        profileEmailDetail: email,
        profileNumber: number || 'Not added yet',
        settingsEmail: `Email: ${email || 'Not available'}`
    };
    for (const [id, value] of Object.entries(textValues)) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    const nameInput = document.getElementById('nameInput');
    const numberInput = document.getElementById('numberInput');
    if (nameInput) nameInput.value = profile.name || user.displayName || '';
    if (numberInput) numberInput.value = number;
}

async function loadProfile(user) {
    const profileRef = doc(db, 'users', user.uid);
    const profileSnapshot = await getDoc(profileRef);
    if (profileSnapshot.exists()) {
        currentProfile = profileSnapshot.data();
    } else {
        currentProfile = {
            userKey: user.uid,
            email: user.email || '',
            name: user.displayName || '',
            contactNo: '',
            imageUrl: user.photoURL || ''
        };
        await setDoc(profileRef, { ...currentProfile, createdAt: serverTimestamp() }, { merge: true });
    }
    renderProfile(user, currentProfile);
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('./login.html');
        return;
    }

    signedInUser = user;
    renderProfile(user, {
        name: user.displayName || '',
        email: user.email || '',
        imageUrl: user.photoURL || ''
    });
    setMessage('Loading your profile…');

    try {
        await loadProfile(user);
        setMessage('');
    } catch (error) {
        renderProfile(user, currentProfile);
        setMessage('Profile load nahi ho saka. Firebase Firestore rules check karein.');
        console.error('Could not load signed-in user profile:', error);
    }
});

if (pictureInput) {
    pictureInput.addEventListener('change', () => {
        const file = pictureInput.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            pictureInput.value = '';
            setMessage('Profile picture ke liye image file select karein.');
            return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        showAvatar('profileImage', 'profileFallback', previewUrl, document.getElementById('nameInput')?.value, signedInUser?.email);
        setMessage('');
    });
}

if (profileForm) {
    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!signedInUser) return;

        const name = document.getElementById('nameInput').value.trim();
        const contactNo = document.getElementById('numberInput').value.trim();
        const picture = pictureInput?.files?.[0] || null;
        if (!name || !contactNo) {
            setMessage('Name aur number dono fill karein.');
            return;
        }
        if (picture && !picture.type.startsWith('image/')) {
            setMessage('Profile picture ke liye image file select karein.');
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = 'Saving…';
        setMessage('');

        try {
            let imageUrl = currentProfile.imageUrl || signedInUser.photoURL || '';
            if (picture) {
                const safeFileName = picture.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const pictureRef = ref(storage, `user-images/${signedInUser.uid}/${Date.now()}-${safeFileName}`);
                await uploadBytes(pictureRef, picture, { contentType: picture.type });
                imageUrl = await getDownloadURL(pictureRef);
            }

            await updateProfile(signedInUser, {
                displayName: name,
                ...(picture ? { photoURL: imageUrl } : {})
            });
            const updatedProfile = {
                ...currentProfile,
                userKey: signedInUser.uid,
                email: signedInUser.email || '',
                name,
                contactNo,
                imageUrl
            };
            await setDoc(doc(db, 'users', signedInUser.uid), { ...updatedProfile, updatedAt: serverTimestamp() }, { merge: true });
            currentProfile = updatedProfile;
            renderProfile(signedInUser, currentProfile);
            pictureInput.value = '';
            setMessage('Aapki profile update ho gayi.', true);
        } catch (error) {
            const messages = {
                'storage/unauthorized': 'Picture upload nahi ho saka. Firebase Storage rules check karein.',
                'permission-denied': 'Profile save nahi hui. Firestore rules ko apne account ki permission deni hogi.'
            };
            setMessage(messages[error.code] || error.message || 'Profile update nahi ho saki.');
            console.error('Could not update signed-in user profile:', error);
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Save changes';
        }
    });
}

if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = 'Signing out…';
        try {
            await signOut(auth);
            window.location.replace('./login.html');
        } catch (error) {
            logoutButton.disabled = false;
            logoutButton.textContent = '🚪 Log out';
            setMessage(error.message || 'Logout nahi ho saka. Dobara try karein.');
        }
    });
}
