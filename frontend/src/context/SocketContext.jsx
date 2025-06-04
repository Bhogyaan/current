import React, { createContext, useContext, useEffect, useState } from "react";
import { useRecoilValue } from "recoil";
import { io } from "socket.io-client";
import userAtom from "../atoms/userAtom";
import { motion } from "framer-motion";

export const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketContextProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const user = useRecoilValue(userAtom);
  const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

  useEffect(() => {
    if (!user?._id || user._id === "undefined") {
      console.warn("No valid user ID, skipping socket connection");
      return;
    }

    const socketInstance = io(serverUrl, {
      query: { userId: user._id },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      withCredentials: true,
      forceNew: true,
      timeout: 20000,
      autoConnect: true,
      upgrade: true,
      rememberUpgrade: true,
    });

    setSocket(socketInstance);
    setConnectionStatus("connecting");

    socketInstance.on("connect", () => {
      console.log("Socket connected:", socketInstance.id);
      setConnectionStatus("connected");
    });

    socketInstance.on("getOnlineUsers", (users) => {
      setOnlineUsers(users || []);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
      setConnectionStatus("error");
      setTimeout(() => {
        socketInstance.connect();
      }, 1000);
    });

    socketInstance.on("reconnect", (attempt) => {
      console.log(`Reconnected after ${attempt} attempts`);
      setConnectionStatus("connected");
    });

    socketInstance.on("reconnect_attempt", (attempt) => {
      console.log(`Reconnection attempt ${attempt}`);
      setConnectionStatus("reconnecting");
    });

    socketInstance.on("reconnect_failed", () => {
      console.error("Failed to reconnect");
      setConnectionStatus("failed");
    });

    socketInstance.on("disconnect", (reason) => {
      console.warn("Disconnected:", reason);
      setConnectionStatus("disconnected");
      if (reason === "io server disconnect") {
        socketInstance.connect();
      }
    });

     socketInstance.on("commentAdded", (data) => {
    console.log("New comment received:", data);
  });

  socketInstance.on("commentUpdated", (data) => {
    console.log("Comment updated:", data);
  });

  socketInstance.on("commentDeleted", (data) => {
    console.log("Comment deleted:", data);
  });

  socketInstance.on("commentLiked", (data) => {
    console.log("Comment liked:", data);
  });

    const pingInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit("ping");
      }
    }, 25000);

    return () => {
      clearInterval(pingInterval);
      if (socketInstance) {
        socketInstance.off("connect");
        socketInstance.off("getOnlineUsers");
        socketInstance.off("connect_error");
        socketInstance.off("reconnect");
        socketInstance.off("reconnect_attempt");
        socketInstance.off("reconnect_failed");
        socketInstance.off("disconnect");
        socketInstance.disconnect();
      }
    };
  }, [user?._id, serverUrl]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, connectionStatus }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    </SocketContext.Provider>
  );
};

export default SocketContextProvider;

// import React, { createContext, useContext, useEffect, useState } from 'react';
// import { useRecoilValue } from 'recoil';
// import io from 'socket.io-client';
// import userAtom from '../atoms/userAtom';
// import { motion } from 'framer-motion';

// const SocketContext = createContext();

// export const useSocket = () => {
//   return useContext(SocketContext);
// };

// export const SocketContextProvider = ({ children }) => {
//   const [socket, setSocket] = useState(null);
//   const [onlineUsers, setOnlineUsers] = useState([]);
//   const user = useRecoilValue(userAtom);

//   useEffect(() => {
//     const socketInstance = io('/', {
//       query: {
//         userId: user?._id,
//       },
//     });

//     setSocket(socketInstance);

//     socketInstance.on('getOnlineUsers', (users) => {
//       setOnlineUsers(users);
//     });

//     return () => {
//       socketInstance.close();
//     };
//   }, [user?._id]);

//   return (
//     <SocketContext.Provider value={{ socket, onlineUsers }}>
//       <motion.div
//         initial={{ opacity: 0 }}
//         animate={{ opacity: 1 }}
//         transition={{ duration: 0.5 }}
//       >
//         {children}
//       </motion.div>
//     </SocketContext.Provider>
//   );
// };
