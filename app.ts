
const express= require("express")
const cors = require("cors");
import { addDoc, collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, firestore } from "./firebaseConfig";

require('dotenv').config()




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
let HidePhase = false
let UpdateCallbackTime = Date.now()
let updateTimeCallback: NodeJS.Timeout  | null = null;



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
    locations: ClientUpdate[];
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
let documentRef = doc(firestore, 'games/'+GameID);
const unsubscribeGameDoc = onSnapshot(documentRef, documentSnapshot => {
    if (documentSnapshot.exists()) {
        // @ts-ignore
        const data: GameType = documentSnapshot.data()
        //console.log(data)
        GameDoc = data
    } else {
        // game was deleted, discard this process, handled automatically ??
    }
  });
  let collectionRef = collection(firestore, 'games/' + GameID + "/users");
  const unsubscribeGameUsersCol = onSnapshot(collectionRef, collectionSnapshot => {
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






// server setup
const app = express();
const PORT = 4058;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// use websocket on top
const http = require("http").Server(app);
import { Server } from "socket.io";

const GameServer = new Server(http, {
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
        const decodeResponse = await fetch("https://syirl-auth-backend.netlify.app/.netlify/functions/verify", {
            method: "POST",
            body: JSON.stringify({
                token: IDToken
            })
        })
        const userID = await decodeResponse.text()
       

        
        // verify user and authorisations
        if (GameDoc === null || GameUsers === null) {
            throw Error("Game data or Authorized Users hasnt loaded yet -> error while loading ?")
        }

       


        // check if user is allowed to join game
        if (userID in GameUsers) {
            // check that if user is banned
            if (GameUsers[userID].banned) {
                // this user is banned, destroy socket
                throw Error("banned user")
            }

            // for private games
            if (!GameDoc.public) {
                if (GameDoc.authorizedUsers.includes(userID)) {
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
            USERS[socket.id] = userID
            // @ts-ignore
            LOCATIONS[userID] = {IDToken, banned: false, locations: []}

        }  else if (GameDoc.public) {  // check if game is public
            // add player to list of players
            setDoc(doc(firestore, `games/${GameID}/users/${userID}`), {
                banned: false,
				imposter: false
            })
            // authorized user
            // add user to list
            // @ts-ignore
            USERS[socket.id] = userID
            // @ts-ignore
            LOCATIONS[userID] = {IDToken, banned: false, locations: []}
        } else {
            //console.log(GameUsers)
            // user doenst exist, error
            throw Error("invalid user")
        }

        // successfull!
        // need to send all past players positions
        socket.join(userID) // private room with user for private communications

        const locations: {[id:string]: LocationObjectCoords[]} = {}
        const d = Date.now()
        for (const u of Object.keys(LOCATIONS)) {
            if (!LOCATIONS[u].locations || !GameDoc || LOCATIONS[u].locations.length == 0) continue
            locations[u] = []
            if (Imposters.includes(u) && !Imposters.includes(userID)) 
                LOCATIONS[u].locations.forEach(loc => {
                        if (d-loc.timestamp > (GameDoc?.imposterHideTime || Infinity)) {
                            locations[u].push(loc.coords)
                        }
                    })
            else locations[u] = LOCATIONS[u].locations.map(loc => loc.coords)
                    
         
        }
        socket.emit('all-time-player-locations', locations)
        console.log("sending locations ALL", locations, LOCATIONS)
        
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

    socket.on("location", (data: {location: ClientUpdate}) => {
        // @ts-ignore
        if (!(socket.id in USERS)) return console.log("unverified user")
            console.log("new player location", data.location.coords)
        // @ts-ignore
        const userID = USERS[socket.id]
        //@ts-ignore
        LOCATIONS[userID].locations.push(data.location)
        LOCATIONS[userID].locations[LOCATIONS[userID].locations.length-1].timestamp = Date.now()

        // if imp send straight away his location to other imps  COULD ASSEMBLE WITH OTHER SENDING TO SEND TO EACH USER CUSTOM DATA... FOR OPTIMIZATION AND CLEANNER CODE (ALSO IF NUMBER OF IMPS INCREASE (>2))
        if (Imposters.includes(userID)) {
            Imposters.forEach(impID => {
                if (impID != userID)
                {
                    console.log("sending location of " + userID + " to: " + impID)
                    GameServer.sockets.in(userID).emit("players-location", {[userID]: data.location.coords})
                }
            })
        }
        console.log("STATE", LOCATIONS)
        
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
            HidePhase = false
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




// infinite function callback to start and end when the imposter is visible

function updateTime() {
    if (!GameDoc) {
        updateTimeCallback = setTimeout(updateTime, 10000)
        return
    }
    
    if (HidePhase) {
		HidePhase = false
        UpdateCallbackTime = Date.now() + GameDoc.imposterShowTime
        updateTimeCallback = setTimeout(updateTime, GameDoc.imposterShowTime);

        // send to all players
        console.log("sending imposter visibility update")
        if (GameDoc.imposterShowTime > 3000)
            GameServer.emit("imposter-visiblity", {
                nextHidePhase: Math.ceil(UpdateCallbackTime/1000), // currently in show
                nextShowPhase: Math.ceil((UpdateCallbackTime + GameDoc.imposterHideTime)/1000)
            })
        
    } else {
        HidePhase = true
        UpdateCallbackTime = Date.now() + GameDoc.imposterHideTime
		updateTimeCallback = setTimeout(updateTime, GameDoc.imposterHideTime)

        
        // send to all players
        console.log("sending imposter visibility update 2")
        if (GameDoc.imposterHideTime > 3000)
            GameServer.emit("imposter-visiblity", {
                nextShowPhase: Math.ceil(UpdateCallbackTime/1000), // currently in hide
                nextHidePhase: Math.ceil((UpdateCallbackTime + GameDoc.imposterShowTime)/1000)
            })
    }
    
}
updateTime()



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
    const locations: {[id:string]: LocationObjectCoords} = {}
    
    const millis = Date.now()
    //console.log(millis, NextShowTime, Imposters, GameDoc == null, LOCATIONS)
    

    for (const userID of Object.keys(LOCATIONS)) {
        if (!LOCATIONS[userID].locations || !GameDoc || LOCATIONS[userID].locations.length == 0) continue
        //console.log(Imposters, userID )
        const lastLocationPos = LOCATIONS[userID].locations.length -1
        if (Imposters.includes(userID)) {
           if(!HidePhase) 
            locations[userID] = LOCATIONS[userID].locations[lastLocationPos].coords
        }
        else if (LOCATIONS[userID].locations[lastLocationPos].timestamp >millis -5000)
            locations[userID] = LOCATIONS[userID].locations[lastLocationPos].coords

     
    }
        
        
    
    //console.log("sending now",locations, millis)
    console.log("sending udpate", locations, Object.keys(locations))
    if (Object.keys(locations).length > 0 ) GameServer.emit("players-location", locations)
    
    setTimeout(sendPlayersLocation, updateInterval)
}
setTimeout(sendPlayersLocation, updateInterval)





app.use(cors());

app.get("/api", (req: any, res: any) => {
    console.log("/api")
    res.json({
        message: "Hello world",
    });
});

app.post("/api/bck-loc-update", (req: any, res: any) => {
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


    LOCATIONS[USERS[userID]].locations.push(locationData)

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