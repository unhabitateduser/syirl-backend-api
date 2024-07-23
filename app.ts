
const express= require("express")
require('dotenv').config()
const cors = require("cors");
import { auth, firestore } from "./firebaseConfig";


let lastLocation1:(LocationObjectCoords & {userID: string})[] = []
let lastLocation2:(LocationObjectCoords & {userID: string})[] = []
let loc = 1

// Normaly in prod should be passed by parent, each server thread handles a game 
const GameID =process.env.GC // shareCode
let GameDoc: null | GameType = null
let GameUsers: null | GameUsersType = null
let Imposters: string[] = []

const USERS: {
    [key: string]: string;
} = {}
const LOCATIONS: GameUsersType = {}
const updateInterval = 5000  // in ms


const startMillis = Date.now()
let NextShowTime: number = startMillis + 0 * 60 * 1000

// types
type LatLng = {
    latitude: number;
    longitude: number;
}
type Region = LatLng & {
    latitudeDelta: number;
    longitudeDelta: number;
}
export type GameType = {
    name: string,
    id: string,
    authorizedUsers: string[],
    backendURL: string | null
    mapRegion: Region
    open: boolean,
    owner: string
    public: boolean
    startPosition: LatLng
    location: string
    imposterShowTime: number
    imposterHideTime: number
}
export type GameUsersType = {
    [key:string]: GameUserType
}
export type GameUserType = {
    banned: boolean;
    dbID: string;
    location: ClientUpdate;
    IDToken: string;
    imposter: string
}
export type ClientUpdate = {
    timestamp: number, 
    mocked: boolean, 
    coords: LocationObjectCoords
}
type LocationObjectCoords = {
    latitude: number;
    longitude: number;
    altitude: number;
    accuracy: number;
    altitudeAccuracy: number;
    heading: number;
    speed: number;
}

// create listener to game doc
let documentRef = firestore.doc('games/'+GameID);
const unsubscribeGameDoc = documentRef.onSnapshot(documentSnapshot => {
    if (documentSnapshot.exists) {
        // @ts-ignore
        const data: GameType = documentSnapshot.data()
        //console.log(data)
        GameDoc = data
    } else {
        // game was deleted, discard this process, handled automatically ??
    }
  });
  let collectionRef = firestore.collection('games/' + GameID + "/users");
  const unsubscribeGameUsersCol = collectionRef.onSnapshot(collectionSnapshot => {
    // parse data
    // use collectionSnapshot.docChanges to modify permissions ??
    // parse and convert to key value dict
    const docs = collectionSnapshot.docs.map(doc => {return {uid: doc.id , ...doc.data()}})
    const users: GameUsersType = {}
    
    // @ts-ignore
    docs.forEach(doc => users[doc.uid] = doc)
    
    // update obj
    GameUsers = users
    let tempImps: string[] = []
    for (const userID of Object.keys(users)) {
        if (users[userID].imposter)
            tempImps.push(userID)
    }
    Imposters = tempImps
  });



const app = express();
const PORT = 4058;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//👇🏻 New imports
const http = require("http").Server(app);

const SocketIO = require("socket.io")

const GameServer = new SocketIO.Server(http, {
    cors: {
        origin: "*" //<http://localhost:3000>
    }
});


GameServer.use((socket, next) => {
    
    //console.log("mmm", socket.id, USERS[socket.id])
    next()
  });

//👇🏻 Add this before the app.get() block
GameServer.on('connection', async (socket) => {
    try {
        // get secret user token from headers
        const IDToken = socket.handshake.auth.token
        // verify user
        const decodedIdToken = await auth.verifyIdToken(IDToken)
        // get user info
        const user = await auth.getUser(decodedIdToken.uid)

        
        // verify user and authorisations
        if (GameDoc === null || GameUsers === null) {
            throw Error("Game data or Authorized Users hasnt loaded yet -> error while loading ?")
        }

       


        // check if user is allowed to join game
        if (user.uid in GameUsers) {
            // check that if user is banned
            if (GameUsers[user.uid].banned) {
                // this user is banned, destroy socket
                throw Error("banned user")
            }

            // for private games
            if (!GameDoc.public) {
                if (GameDoc.authorizedUsers.includes(user.uid)) {
                    // authorized user
                }
                 else {
                    // not verified
                    throw Error("need permission to access this game")
                }
            }
            // authorized user
            // add user to list
            // @ts-ignore
            USERS[socket.id] = user.uid
            // @ts-ignore
            LOCATIONS[user.uid] = {IDToken, banned: false}
        }  else if (GameDoc.public) {  // check if game is public
            // add player to list of players
            firestore.doc(`games/${GameID}/users/${user.uid}`).create({
                banned: false,
				imposter: false
            })
            // authorized user
            // add user to list
            // @ts-ignore
            USERS[socket.id] = user.uid
            // @ts-ignore
            LOCATIONS[user.uid] = {IDToken, banned: false}
        } else {
            //console.log(GameUsers)
            // user doenst exist, error
            throw Error("invalid user")
        }
        
    }
    catch(error) {
        //console.log("failed to verify user", error)
        // kill socket
        socket.disconnect()
        return 
    };


    console.log(`⚡: ${socket.id} verified user just connected!`);

    socket.on('disconnect', () => {
      socket.disconnect()
      console.log('🔥: A user disconnected');

    });

    socket.on("location", (data: ClientUpdate) => {
        // @ts-ignore
        if (!(socket.id in USERS)) return console.log("unverified user")
        // @ts-ignore
        const userID = USERS[socket.id]
        //@ts-ignore
        LOCATIONS[userID].location = data.location
        LOCATIONS[userID].location.timestamp = Date.now()

        
        // @ts-ignore
       //console.log("new update from socket", socket.id, userID, data.timestamp, data)
    })

    socket.on("log", (data) =>  {
        const { message } = data 
        //console.log("LOG: "+message)
        socket.emit("private-message", {
            message: "private message 1111",
            // @ts-ignore
            to: socket.id,
          });
        //io.sockets.get(socket.clientid).emit('private-message', 'for your eyes only');
    })



    // admin comands

    socket.on("si", () => {
        if (Imposters.includes(USERS[socket.id]))
            HH = false
    })

    socket.on("setNextShowTime", (data) => {
        if (!GameDoc) return
        if (USERS[socket.id] == GameDoc.owner) {
            NextShowTime = data
        }
    })
    
});

setTimeout(() => {
    GameServer.emit("global", {message: "1234"})
    // tested and send to all users listening on 'global'
    //to send to specefic socket do some research or read: 
    // https://stackoverflow.com/questions/4647348/send-message-to-specific-client-with-socket-io-and-node-js
}, 10000)

let HH = false
let NEXT = Date.now()
function updateTime() {
    if (!GameDoc) {
        setTimeout(updateTime, 10000)
        return
    }
    
    if (HH) {
		HH = false
        NEXT = Date.now() + GameDoc.imposterShowTime
        setTimeout(updateTime, GameDoc.imposterShowTime
      
);
    } else {
        HH = true
        NEXT = Date.now() + GameDoc.imposterHideTime
		setTimeout(updateTime, GameDoc.imposterHideTime)
    }
    
}
updateTime()

function verifyTimeForImp (millis: number) {
    if (!GameDoc) return false
    console.log(4)
    if (millis > NextShowTime) {
        if (millis < NextShowTime + GameDoc.imposterShowTime) {
            // in show time: send coordinates
            GameServer.emit("showI", (NextShowTime + GameDoc.imposterShowTime) -millis
            )
            console.log(1)
            return true
        } else {
            // ran out of show time: don't show coordinates and update next showTime
            NextShowTime = Date.now() + GameDoc.imposterHideTime
            GameServer.emit("hideI",NextShowTime-millis)
            console.log("2")
        }
    } else {
        // in hide time: don't send coordinates
        GameServer.emit('hideI', (NextShowTime + GameDoc.imposterHideTime)-millis)
        console.log(3)
    }
    return false
    
}

// send every 2 secs location update
function sendPlayersLocation() {
    console.log("sending udpate")
    const locations: {[id:string]: LocationObjectCoords} = {}
    
    const millis = Date.now()
    //console.log(millis, NextShowTime, Imposters, GameDoc == null, LOCATIONS)
    

    for (const userID of Object.keys(LOCATIONS)) {
        if (!LOCATIONS[userID].location || !GameDoc) continue
        //console.log(Imposters, userID )
        if (Imposters.includes(userID)) {
           if(!HH) 
            locations[userID] = LOCATIONS[userID].location.coords
        }
        else if (LOCATIONS[userID].location.timestamp >millis -5000)
            locations[userID] = LOCATIONS[userID].location.coords

     
    }
            if (!HH) {
                
                GameServer.emit("hideI", NEXT - millis)
            }else {
                GameServer.emit("showI", NEXT-millis)
            }
        
        
    
    //console.log("sending now",locations, millis)
    GameServer.emit("players-location", locations)
    lastLocation1 = []
    setTimeout(sendPlayersLocation, updateInterval)
}
setTimeout(sendPlayersLocation, updateInterval)


app.use(cors());

app.get("/api", (req, res) => {
    console.log("/api")
    res.json({
        message: "Hello world",
    });
});

app.post("/api/bck-loc-update", (req, res) => {
    const {userID, authToken, locationData} = req.body
    console.log("/api/bck-loc-update", req.body)
    if (typeof userID != "string" || typeof authToken != "string" || typeof locationData != "object") {
        res.statusCode = 400
        res.end()
        return
    }


    if (!(USERS[userID] && LOCATIONS[USERS[userID]] && LOCATIONS[USERS[userID]].IDToken == authToken)) {
        res.statusCode = 401
        res.end()
        return
    }

    // verified user


    LOCATIONS[USERS[userID]].location = locationData

    res.statusCode = 200
    res.end()
})

http.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
});

/*

{
    location: { timestamp: 1719063995434, mocked: false, coords: [Object] },
    userID: 'DCAdUE6QDOaZRPnUWv3kpNOBGrh1'
  }

*/