import { io } from "socket.io-client";

let socket = null;
let authToken = null;
const roomRefs = new Map();

function socketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  // Dev: connect to API directly so notifications aren't lost via proxy flakes
  if (import.meta.env.DEV) return "http://localhost:4000";
  return undefined;
}

function ensureJoin(s) {
  if (!s || !authToken) return;
  s.emit("join", authToken);
  for (const key of roomRefs.keys()) {
    const [kind, id] = key.split(":");
    if (kind === "project") {
      s.emit("joinProject", { token: authToken, projectId: Number(id) });
    } else if (kind === "issue") {
      s.emit("joinIssue", { token: authToken, issueId: Number(id) });
    }
  }
}

export function getSocket() {
  if (!socket) {
    socket = io(socketUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: false,
    });

    socket.on("connect", () => {
      ensureJoin(socket);
    });
  }
  return socket;
}

export function connectSocket(token) {
  authToken = token;
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  } else {
    ensureJoin(s);
  }
  return s;
}

export function disconnectSocket() {
  if (!socket) return;
  roomRefs.clear();
  authToken = null;
  const s = socket;
  socket = null;
  s.removeAllListeners();
  s.disconnect();
}

function roomKey(kind, id) {
  return `${kind}:${id}`;
}

export function joinProjectRoom(token, projectId) {
  const id = Number(projectId);
  if (!Number.isInteger(id) || id <= 0) return () => {};
  authToken = token || authToken;
  const s = connectSocket(authToken);
  const key = roomKey("project", id);
  roomRefs.set(key, (roomRefs.get(key) || 0) + 1);
  if (roomRefs.get(key) === 1) {
    const join = () => s.emit("joinProject", { token: authToken, projectId: id });
    if (s.connected) join();
    else s.once("connect", join);
  }
  return () => leaveProjectRoom(id);
}

export function leaveProjectRoom(projectId) {
  const id = Number(projectId);
  const key = roomKey("project", id);
  const next = (roomRefs.get(key) || 1) - 1;
  if (next <= 0) {
    roomRefs.delete(key);
    socket?.emit("leaveProject", { projectId: id });
  } else {
    roomRefs.set(key, next);
  }
}

export function joinIssueRoom(token, issueId) {
  const id = Number(issueId);
  if (!Number.isInteger(id) || id <= 0) return () => {};
  authToken = token || authToken;
  const s = connectSocket(authToken);
  const key = roomKey("issue", id);
  roomRefs.set(key, (roomRefs.get(key) || 0) + 1);
  if (roomRefs.get(key) === 1) {
    const join = () => s.emit("joinIssue", { token: authToken, issueId: id });
    if (s.connected) join();
    else s.once("connect", join);
  }
  return () => leaveIssueRoom(id);
}

export function leaveIssueRoom(issueId) {
  const id = Number(issueId);
  const key = roomKey("issue", id);
  const next = (roomRefs.get(key) || 1) - 1;
  if (next <= 0) {
    roomRefs.delete(key);
    socket?.emit("leaveIssue", { issueId: id });
  } else {
    roomRefs.set(key, next);
  }
}
