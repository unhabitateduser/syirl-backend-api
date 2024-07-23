import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
var admin = require("firebase-admin");




var serviceAccount = require("./fsa.json");

const app = initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const auth = getAuth(app)
const firestore = getFirestore()

export { auth, firestore, app }