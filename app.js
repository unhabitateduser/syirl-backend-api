"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var cors = require("cors");
var firestore_1 = require("firebase/firestore");
var firebaseConfig_1 = require("./firebaseConfig");
require("dotenv").config();
var COLORS = [
    "800000",
    "9A6324",
    "808000",
    "469990",
    "000075",
    "f58231",
    "3cb44b",
    "ffe119",
    "4363d8",
    "42d4f4",
    "911eb4",
    "f032e6",
    "bfef45",
];
// Normaly in prod should be passed by parent, each server thread handles a game
var GameID = process.env.GC; // shareCode
var GameDoc = null;
var GameUsers = null;
var Imposters = [];
var USERS = {};
var LOCATIONS = {};
var updateInterval = 5000; // in ms
var startMillis = Date.now();
var NextShowTime = startMillis + 0 * 60 * 1000;
var HidePhase = false;
var UpdateCallbackTime = Date.now();
var updateTimeCallback = null;
// create listener to game doc
var documentRef = (0, firestore_1.doc)(firebaseConfig_1.firestore, "games/" + GameID);
var unsubscribeGameDoc = (0, firestore_1.onSnapshot)(documentRef, function (documentSnapshot) {
    if (documentSnapshot.exists()) {
        // @ts-ignore
        var data = documentSnapshot.data();
        //console.log(data)
        GameDoc = data;
    }
    else {
        // game was deleted, discard this process, handled automatically ??
    }
});
var collectionRef = (0, firestore_1.collection)(firebaseConfig_1.firestore, "games/" + GameID + "/users");
var unsubscribeGameUsersCol = (0, firestore_1.onSnapshot)(collectionRef, function (collectionSnapshot) {
    // parse data
    // use collectionSnapshot.docChanges to modify permissions ??
    // parse and convert to key value dict
    var docs = collectionSnapshot.docs.map(function (doc) {
        return __assign({ uid: doc.id }, doc.data());
    });
    var users = {};
    // @ts-ignore
    docs.forEach(function (doc) { return (users[doc.uid] = doc); });
    // update obj
    GameUsers = users;
    var tempImps = [];
    for (var _i = 0, _a = Object.keys(users); _i < _a.length; _i++) {
        var userID = _a[_i];
        if (users[userID].imposter)
            tempImps.push(userID);
    }
    Imposters = tempImps;
});
// server setup
var app = express();
var PORT = 4058;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// use websocket on top
var http = require("http").Server(app);
var socket_io_1 = require("socket.io");
var GameServer = new socket_io_1.Server(http, {
    cors: {
        origin: "*", //<http://localhost:3000>
    },
});
GameServer.use(function (socket, next) {
    //console.log("mmm", socket.id, USERS[socket.id])
    next();
});
//👇🏻 Add this before the app.get() block
GameServer.on("connection", function (socket) { return __awaiter(void 0, void 0, void 0, function () {
    var IDToken, decodeResponse, userID, locations_1, d_1, _loop_1, _i, _a, u, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 7, , 8]);
                IDToken = socket.handshake.auth.token;
                return [4 /*yield*/, fetch("https://syirl-auth-backend.netlify.app/.netlify/functions/verify", {
                        method: "POST",
                        body: JSON.stringify({
                            token: IDToken,
                        }),
                    })];
            case 1:
                decodeResponse = _b.sent();
                return [4 /*yield*/, decodeResponse.text()];
            case 2:
                userID = _b.sent();
                // verify user and authorisations
                if (GameDoc === null || GameUsers === null) {
                    throw Error("Game data or Authorized Users hasnt loaded yet -> error while loading ?");
                }
                if (!(userID in GameUsers)) return [3 /*break*/, 3];
                // check that if user is banned
                if (GameUsers[userID].banned) {
                    // this user is banned, destroy socket
                    throw Error("banned user");
                }
                // for private games
                if (!GameDoc.public) {
                    if (GameDoc.authorizedUsers.includes(userID)) {
                        // authorized user
                    }
                    else {
                        // not verified
                        throw Error("need permission to access this game");
                    }
                }
                // authorized user
                // add user to list
                // @ts-ignore
                USERS[socket.id] = userID;
                if (!LOCATIONS[userID])
                    // @ts-ignore
                    LOCATIONS[userID] = { IDToken: IDToken, banned: false, locations: [] };
                return [3 /*break*/, 6];
            case 3:
                if (!GameDoc.public) return [3 /*break*/, 5];
                // check if game is public
                // add player to list of players
                console.log("added new player");
                return [4 /*yield*/, (0, firestore_1.setDoc)((0, firestore_1.doc)(firebaseConfig_1.firestore, "games/".concat(GameID, "/users/").concat(userID)), {
                        banned: false,
                        imposter: false,
                    })];
            case 4:
                _b.sent();
                // authorized user
                // add user to list
                // @ts-ignore
                USERS[socket.id] = userID;
                if (!LOCATIONS[userID])
                    // @ts-ignore
                    LOCATIONS[userID] = { IDToken: IDToken, banned: false, locations: [] };
                return [3 /*break*/, 6];
            case 5: 
            //console.log(GameUsers)
            // user doenst exist, error
            throw Error("invalid user");
            case 6:
                // successfull!
                //select color
                if (GameUsers)
                    // @ts-ignore
                    Object.keys(GameUsers).every(function (u) { return COLORS.includes(GameUsers[u].color); });
                // need to send all past players positions
                socket.join(userID); // private room with user for private communications
                locations_1 = {};
                d_1 = Date.now();
                _loop_1 = function (u) {
                    if (!LOCATIONS[u].locations ||
                        !GameDoc ||
                        LOCATIONS[u].locations.length == 0)
                        return "continue";
                    locations_1[u] = [];
                    if (Imposters.includes(u))
                        // && !Imposters.includes(userID)
                        LOCATIONS[u].locations.forEach(function (loc) {
                            if (d_1 - loc.timestamp > ((GameDoc === null || GameDoc === void 0 ? void 0 : GameDoc.imposterHideTime) || Infinity)) {
                                locations_1[u].push(loc.coords);
                            }
                        });
                    else
                        locations_1[u] = LOCATIONS[u].locations.map(function (loc) { return loc.coords; });
                };
                for (_i = 0, _a = Object.keys(LOCATIONS); _i < _a.length; _i++) {
                    u = _a[_i];
                    _loop_1(u);
                }
                socket.emit("all-time-player-locations", locations_1);
                //console.log("sending locations ALL", locations, LOCATIONS)
                console.log("emitting location to connected players");
                return [3 /*break*/, 8];
            case 7:
                error_1 = _b.sent();
                //console.log("failed to verify user", error)
                // kill socket
                socket.disconnect();
                return [2 /*return*/];
            case 8:
                console.log(
                // @ts-ignore
                "\u26A1: ".concat(USERS[socket.id], " verified user just connected!"));
                socket.on("disconnect", function () {
                    socket.disconnect();
                    // @ts-ignore
                    console.log("\uD83D\uDD25: ".concat(GameUsers[USERS[socket.id]].uid, " A user disconnected"));
                });
                socket.on("location", function (data) {
                    // @ts-ignore
                    if (!(socket.id in USERS))
                        return console.log("unverified user");
                    // @ts-ignore
                    console.log(
                    // @ts-ignore
                    "new player location from ".concat(GameUsers[USERS[socket.id]].uid, " "), data.f ? "FROM FOREGROUND" : "FROM BACKGROUND", "total locs: ", LOCATIONS[USERS[socket.id]].locations.length + 1, "latest pos: ", data.location.coords.latitude, data.location.coords.longitude);
                    // @ts-ignore
                    var userID = USERS[socket.id];
                    //@ts-ignore
                    LOCATIONS[userID].locations.push(data.location);
                    LOCATIONS[userID].locations[LOCATIONS[userID].locations.length - 1].timestamp = Date.now();
                    // if imp send straight away his location to other imps  COULD ASSEMBLE WITH OTHER SENDING TO SEND TO EACH USER CUSTOM DATA... FOR OPTIMIZATION AND CLEANNER CODE (ALSO IF NUMBER OF IMPS INCREASE (>2))
                    if (Imposters.includes(userID)) {
                        Imposters.forEach(function (impID) {
                            var _a;
                            if (impID != userID) {
                                console.log("sending location of " + userID + " to: " + impID);
                                GameServer.sockets
                                    .in(userID)
                                    .emit("players-location", (_a = {}, _a[userID] = data.location.coords, _a));
                            }
                        });
                    }
                    // @ts-ignore
                    //console.log("new update from socket", socket.id, userID, data.timestamp, data)
                });
                socket.on("log", function (data) {
                    var message = data.message;
                    //console.log("LOG: "+message)
                    socket.emit("private-message", {
                        message: "private message 1111",
                        // @ts-ignore
                        to: socket.id,
                    });
                    //io.sockets.get(socket.clientid).emit('private-message', 'for your eyes only');
                });
                // admin comands
                socket.on("si", function () {
                    if (Imposters.includes(USERS[socket.id]))
                        HidePhase = false;
                });
                socket.on("setNextShowTime", function (data) {
                    if (!GameDoc)
                        return;
                    if (USERS[socket.id] == GameDoc.owner) {
                        NextShowTime = data;
                    }
                });
                return [2 /*return*/];
        }
    });
}); });
setTimeout(function () {
    GameServer.emit("global", { message: "1234" });
    // tested and send to all users listening on 'global'
    //to send to specefic socket do some research or read:
    // https://stackoverflow.com/questions/4647348/send-message-to-specific-client-with-socket-io-and-node-js
}, 10000);
// infinite function callback to start and end when the imposter is visible
function updateTime() {
    if (!GameDoc) {
        updateTimeCallback = setTimeout(updateTime, 10000);
        return;
    }
    if (HidePhase) {
        HidePhase = false;
        UpdateCallbackTime = Date.now() + GameDoc.imposterShowTime;
        updateTimeCallback = setTimeout(updateTime, GameDoc.imposterShowTime);
        // send to all players
        console.log("sending imposter visibility update");
        if (GameDoc.imposterShowTime > 3000)
            GameServer.emit("imposter-visiblity", {
                nextHidePhase: Math.ceil(UpdateCallbackTime / 1000), // currently in show
                nextShowPhase: Math.ceil((UpdateCallbackTime + GameDoc.imposterHideTime) / 1000),
            });
    }
    else {
        HidePhase = true;
        UpdateCallbackTime = Date.now() + GameDoc.imposterHideTime;
        updateTimeCallback = setTimeout(updateTime, GameDoc.imposterHideTime);
        // send to all players
        console.log("sending imposter visibility update 2");
        if (GameDoc.imposterHideTime > 3000)
            GameServer.emit("imposter-visiblity", {
                nextShowPhase: Math.ceil(UpdateCallbackTime / 1000), // currently in hide
                nextHidePhase: Math.ceil((UpdateCallbackTime + GameDoc.imposterShowTime) / 1000),
            });
    }
}
updateTime();
// function verifyTimeForImp (millis: number) {
//     if (!GameDoc) return false
//     console.log(4)
//     if (millis > NextShowTime) {
//         if (millis < NextShowTime + GameDoc.imposterShowTime) {
//             // in show time: send coordinates
//             GameServer.emit("showI", (NextShowTime + GameDoc.imposterShowTime) -millis
//             )
//             console.log(1)
//             return true
//         } else {
//             // ran out of show time: don't show coordinates and update next showTime
//             NextShowTime = Date.now() + GameDoc.imposterHideTime
//             GameServer.emit("hideI",NextShowTime-millis)
//             console.log("2")
//         }
//     } else {
//         // in hide time: don't send coordinates
//         GameServer.emit('hideI', (NextShowTime + GameDoc.imposterHideTime)-millis)
//         console.log(3)
//     }
//     return false
// }
// SEND LOCATION OF ALL PLAYERS
// send every x secs location update
function sendPlayersLocation() {
    var locations = {};
    var millis = Date.now();
    //console.log(millis, NextShowTime, Imposters, GameDoc == null, LOCATIONS)
    for (var _i = 0, _a = Object.keys(LOCATIONS); _i < _a.length; _i++) {
        var userID = _a[_i];
        if (!LOCATIONS[userID].locations ||
            !GameDoc ||
            LOCATIONS[userID].locations.length == 0)
            continue;
        //console.log(Imposters, userID )
        var lastLocationPos = LOCATIONS[userID].locations.length - 1;
        if (Imposters.includes(userID)) {
            if (!HidePhase)
                locations[userID] = LOCATIONS[userID].locations[lastLocationPos].coords;
        }
        else if (LOCATIONS[userID].locations[lastLocationPos].timestamp >
            millis - 5000)
            locations[userID] = LOCATIONS[userID].locations[lastLocationPos].coords;
    }
    //console.log("sending now",locations, millis)
    console.log("sending udpate");
    if (Object.keys(locations).length > 0)
        GameServer.emit("players-location", locations);
    setTimeout(sendPlayersLocation, updateInterval);
}
setTimeout(sendPlayersLocation, updateInterval);
app.use(cors());
app.get("/api", function (req, res) {
    console.log("/api");
    res.json({
        message: "Hello world",
    });
});
app.post("/api/bck-loc-update", function (req, res) {
    var _a = req.body, userID = _a.userID, authToken = _a.authToken, locationData = _a.locationData;
    console.log("/api/bck-loc-update", req.body);
    if (typeof userID != "string" ||
        typeof authToken != "string" ||
        typeof locationData != "object") {
        res.statusCode = 400;
        res.end();
        return;
    }
    if (!(USERS[userID] &&
        LOCATIONS[USERS[userID]] &&
        LOCATIONS[USERS[userID]].IDToken == authToken)) {
        res.statusCode = 401;
        res.end();
        return;
    }
    // verified user
    LOCATIONS[USERS[userID]].locations.push(locationData);
    res.statusCode = 200;
    res.end();
});
http.listen(PORT, function () {
    console.log("Server listening on ".concat(PORT));
});
/*

{
    location: { timestamp: 1719063995434, mocked: false, coords: [Object] },
    userID: 'DCAdUE6QDOaZRPnUWv3kpNOBGrh1'
  }

*/
