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
var firebaseConfig_1 = require("./firebaseConfig");
var lastLocation1 = [];
var lastLocation2 = [];
var loc = 1;
// Normaly in prod should be passed by parent, each server thread handles a game 
var GameID = "RKoS1P1h7Sd8pyYHUqWd"; // shareCode
var GameDoc = null;
var GameUsers = null;
var Imposters = [];
var USERS = {};
var LOCATIONS = {};
var updateInterval = 5000; // in ms
var startMillis = Date.now();
var NextShowTime = startMillis + 0 * 60 * 1000;
// create listener to game doc
var documentRef = firebaseConfig_1.firestore.doc('games/' + GameID);
var unsubscribeGameDoc = documentRef.onSnapshot(function (documentSnapshot) {
    if (documentSnapshot.exists) {
        // @ts-ignore
        var data = documentSnapshot.data();
        //console.log(data)
        GameDoc = data;
    }
    else {
        // game was deleted, discard this process, handled automatically ??
    }
});
var collectionRef = firebaseConfig_1.firestore.collection('games/' + GameID + "/users");
var unsubscribeGameUsersCol = collectionRef.onSnapshot(function (collectionSnapshot) {
    // parse data
    // use collectionSnapshot.docChanges to modify permissions ??
    // parse and convert to key value dict
    var docs = collectionSnapshot.docs.map(function (doc) { return __assign({ uid: doc.id }, doc.data()); });
    var users = {};
    // @ts-ignore
    docs.forEach(function (doc) { return users[doc.uid] = doc; });
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
var app = express();
var PORT = 4058;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
//👇🏻 New imports
var http = require("http").Server(app);
var SocketIO = require("socket.io");
var GameServer = new SocketIO.Server(http, {
    cors: {
        origin: "*" //<http://localhost:3000>
    }
});
GameServer.use(function (socket, next) {
    //console.log("mmm", socket.id, USERS[socket.id])
    next();
});
//👇🏻 Add this before the app.get() block
GameServer.on('connection', function (socket) { return __awaiter(void 0, void 0, void 0, function () {
    var IDToken, decodedIdToken, user, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                IDToken = socket.handshake.auth.token;
                return [4 /*yield*/, firebaseConfig_1.auth.verifyIdToken(IDToken)
                    // get user info
                ];
            case 1:
                decodedIdToken = _a.sent();
                return [4 /*yield*/, firebaseConfig_1.auth.getUser(decodedIdToken.uid)
                    // verify user and authorisations
                ];
            case 2:
                user = _a.sent();
                // verify user and authorisations
                if (GameDoc === null || GameUsers === null) {
                    throw Error("Game data or Authorized Users hasnt loaded yet -> error while loading ?");
                }
                // check if user is allowed to join game
                if (user.uid in GameUsers) {
                    // check that if user is banned
                    if (GameUsers[user.uid].banned) {
                        // this user is banned, destroy socket
                        throw Error("banned user");
                    }
                    // for private games
                    if (!GameDoc.public) {
                        if (GameDoc.authorizedUsers.includes(user.uid)) {
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
                    USERS[socket.id] = user.uid;
                    // @ts-ignore
                    LOCATIONS[user.uid] = { IDToken: IDToken, banned: false };
                }
                else if (GameDoc.public) { // check if game is public
                    // add player to list of players
                    firebaseConfig_1.firestore.doc("games/".concat(GameID, "/users/").concat(user.uid)).create({
                        banned: false,
                        imposter: false
                    });
                    // authorized user
                    // add user to list
                    // @ts-ignore
                    USERS[socket.id] = user.uid;
                    // @ts-ignore
                    LOCATIONS[user.uid] = { IDToken: IDToken, banned: false };
                }
                else {
                    //console.log(GameUsers)
                    // user doenst exist, error
                    throw Error("invalid user");
                }
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                //console.log("failed to verify user", error)
                // kill socket
                socket.disconnect();
                return [2 /*return*/];
            case 4:
                ;
                console.log("\u26A1: ".concat(socket.id, " verified user just connected!"));
                socket.on('disconnect', function () {
                    socket.disconnect();
                    console.log('🔥: A user disconnected');
                });
                socket.on("location", function (data) {
                    // @ts-ignore
                    if (!(socket.id in USERS))
                        return console.log("unverified user");
                    // @ts-ignore
                    var userID = USERS[socket.id];
                    //@ts-ignore
                    LOCATIONS[userID].location = data.location;
                    LOCATIONS[userID].location.timestamp = Date.now();
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
                        HH = false;
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
var HH = false;
var NEXT = Date.now();
function updateTime() {
    if (!GameDoc) {
        setTimeout(updateTime, 10000);
        return;
    }
    if (HH) {
        HH = false;
        NEXT = Date.now() + GameDoc.imposterShowTime;
        setTimeout(updateTime, GameDoc.imposterShowTime);
    }
    else {
        HH = true;
        NEXT = Date.now() + GameDoc.imposterHideTime;
        setTimeout(updateTime, GameDoc.imposterHideTime);
    }
}
updateTime();
function verifyTimeForImp(millis) {
    if (!GameDoc)
        return false;
    console.log(4);
    if (millis > NextShowTime) {
        if (millis < NextShowTime + GameDoc.imposterShowTime) {
            // in show time: send coordinates
            GameServer.emit("showI", (NextShowTime + GameDoc.imposterShowTime) - millis);
            console.log(1);
            return true;
        }
        else {
            // ran out of show time: don't show coordinates and update next showTime
            NextShowTime = Date.now() + GameDoc.imposterHideTime;
            GameServer.emit("hideI", NextShowTime - millis);
            console.log("2");
        }
    }
    else {
        // in hide time: don't send coordinates
        GameServer.emit('hideI', (NextShowTime + GameDoc.imposterHideTime) - millis);
        console.log(3);
    }
    return false;
}
// send every 2 secs location update
function sendPlayersLocation() {
    console.log("sending udpate");
    var locations = {};
    var millis = Date.now();
    //console.log(millis, NextShowTime, Imposters, GameDoc == null, LOCATIONS)
    for (var _i = 0, _a = Object.keys(LOCATIONS); _i < _a.length; _i++) {
        var userID = _a[_i];
        if (!LOCATIONS[userID].location || !GameDoc)
            continue;
        //console.log(Imposters, userID )
        if (Imposters.includes(userID)) {
            if (!HH)
                locations[userID] = LOCATIONS[userID].location.coords;
        }
        else if (LOCATIONS[userID].location.timestamp > millis - 5000)
            locations[userID] = LOCATIONS[userID].location.coords;
    }
    if (!HH) {
        GameServer.emit("hideI", NEXT - millis);
    }
    else {
        GameServer.emit("showI", NEXT - millis);
    }
    //console.log("sending now",locations, millis)
    GameServer.emit("players-location", locations);
    lastLocation1 = [];
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
    if (typeof userID != "string" || typeof authToken != "string" || typeof locationData != "object") {
        res.statusCode = 400;
        res.end();
        return;
    }
    if (!(USERS[userID] && LOCATIONS[USERS[userID]] && LOCATIONS[USERS[userID]].IDToken == authToken)) {
        res.statusCode = 401;
        res.end();
        return;
    }
    // verified user
    LOCATIONS[USERS[userID]].location = locationData;
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
