"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.firestore = exports.auth = void 0;
var app_1 = require("firebase/app");
var firestore_1 = require("firebase/firestore");
var auth_1 = require("firebase/auth");
// Required for side-effects
require("firebase/firestore");
// TODO: Replace the following with your app's Firebase project configuration
// See: https://support.google.com/firebase/answer/7015592
var firebaseConfig = {
    apiKey: "AIzaSyCT16vnwbfzaAOGLqGnAb_lw24-gh_A94w",
    authDomain: "scotland-yard-in-real-life.firebaseapp.com",
    projectId: "scotland-yard-in-real-life",
    storageBucket: "scotland-yard-in-real-life.appspot.com",
    messagingSenderId: "87421038815",
    appId: "1:87421038815:web:6633e1badad171000ef96a",
    measurementId: "G-V121WZJTQN"
};
// Initialize Firebase
var app = (0, app_1.initializeApp)(firebaseConfig);
exports.app = app;
// Initialize Cloud Firestore and get a reference to the service
var firestore = (0, firestore_1.getFirestore)(app);
exports.firestore = firestore;
// Initialize Firebase Authentication and get a reference to the service
var auth = (0, auth_1.getAuth)(app);
exports.auth = auth;
