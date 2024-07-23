"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.firestore = exports.auth = void 0;
var app_1 = require("firebase-admin/app");
var auth_1 = require("firebase-admin/auth");
var firestore_1 = require("firebase-admin/firestore");
var admin = require("firebase-admin");
var serviceAccount = require("fsa.json");
var app = (0, app_1.initializeApp)({
    credential: admin.credential.cert(serviceAccount)
});
exports.app = app;
var auth = (0, auth_1.getAuth)(app);
exports.auth = auth;
var firestore = (0, firestore_1.getFirestore)();
exports.firestore = firestore;
