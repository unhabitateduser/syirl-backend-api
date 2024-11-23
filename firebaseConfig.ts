import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import firebase from "firebase/compat/app";
import { getAuth } from "firebase/auth";

// Required for side-effects
import "firebase/firestore";


// TODO: Replace the following with your app's Firebase project configuration
// See: https://support.google.com/firebase/answer/7015592
const firebaseConfig = {

    apiKey: "AIzaSyCT16vnwbfzaAOGLqGnAb_lw24-gh_A94w",
  
    authDomain: "scotland-yard-in-real-life.firebaseapp.com",
  
    projectId: "scotland-yard-in-real-life",
  
    storageBucket: "scotland-yard-in-real-life.appspot.com",
  
    messagingSenderId: "87421038815",
  
    appId: "1:87421038815:web:6633e1badad171000ef96a",
  
    measurementId: "G-V121WZJTQN"
  
  };
  

// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Initialize Cloud Firestore and get a reference to the service
const firestore = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);



export { auth, firestore, app }