import { io } from "socket.io-client";
import { BASE_URL } from "./api";

export const createRealtimeSocket = ({ token }) => {
  return io(BASE_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
};
