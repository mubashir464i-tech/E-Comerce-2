import { firebaseConfig } from './config/firebase_config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {
    getAuth,
    getRedirectResult,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const form = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const googleButton = document.getElementById('googleButton');
const message = document.getElementById('authMessage');

let redirectCheckComplete = false;
let pendingUser = null;
let navigationStarted = false;

function showError(error) {
    const messages = {
        'auth/invalid-credential': 'Email ya password sahi nahi hai.',
        'auth/user-not-found': 'Is email ka account nahi mila.',
        'auth/wrong-password': 'Password sahi nahi hai.',
        'auth/too-many-requests': 'Bohat zyada koshishen hui hain. Kuch dair baad dobara try karein.',
        'auth/popup-closed-by-user': 'Google sign-in window band ho gayi.',
        'auth/operation-not-allowed': 'Firebase Console mein Authentication > Sign-in method ke andar Google provider enable karein.',
        'auth/unauthorized-domain': `Firebase Console ke Authorized domains mein ${window.location.hostname} add karein.`,
        'auth/popup-blocked': 'Google popup block hua. Redirect sign-in try karein.',
        'auth/operation-not-supported-in-this-environment': 'Login ko file:// se nahi, localhost ya hosted website se open karein.',
        'auth/account-exists-with-different-credential': 'Is email par pehle doosra sign-in method use hua hai. Usi method se login karein.',
        'auth/network-request-failed': 'Network issue hai. Connection check karke dobara try karein.'
    };
    message.textContent = messages[error.code] || error.message || 'Login nahi ho saka. Dobara try karein.';
}

function openProfile(user) {
    if (!user) return;
    pendingUser = user;
    if (!redirectCheckComplete || navigationStarted) return;
    navigationStarted = true;
    window.location.replace('./admin.html');
}

onAuthStateChanged(auth, (user) => {
    if (user) openProfile(user);
});

getRedirectResult(auth)
    .then((result) => {
        if (result?.user) pendingUser = result.user;
    })
    .catch(showError)
    .finally(() => {
        redirectCheckComplete = true;
        openProfile(pendingUser || auth.currentUser);
    });

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in…';

    try {
        const email = form.elements.email.value.trim();
        const password = form.elements.password.value;
        const credential = await signInWithEmailAndPassword(auth, email, password);
        openProfile(credential.user);
    } catch (error) {
        showError(error);
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Continue';
    }
});

googleButton.addEventListener('click', async () => {
    message.textContent = '';
    googleButton.disabled = true;
    googleButton.textContent = 'Connecting…';
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
        const credential = await signInWithPopup(auth, provider);
        openProfile(credential.user);
    } catch (error) {
        if (error.code === 'auth/popup-blocked') {
            try {
                googleButton.textContent = 'Redirecting to Google…';
                await signInWithRedirect(auth, provider);
                return;
            } catch (redirectError) {
                showError(redirectError);
            }
        } else {
            showError(error);
        }
    } finally {
        googleButton.disabled = false;
        googleButton.textContent = 'Continue With Google';
    }
});
