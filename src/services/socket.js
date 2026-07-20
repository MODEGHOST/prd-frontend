import { io } from "socket.io-client";

let socket = null;
const roomRefs = new Map();

function socketUrl() {
  // Prefer same-origin (Vite proxy / production reverse proxy) so httpOnly cookies are sent.
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  return undefined;
}

function ensureJoin(s) {
  if (!s) return;
  s.emit("join", {});
  for (const key of roomRefs.keys()) {
    const [kind, id] = key.split(":");
    if (kind === "project") {
      s.emit("joinProject", { projectId: Number(id) });
    } else if (kind === "issue") {
      s.emit("joinIssue", { issueId: Number(id) });
    }
  }
}

export function getSocket() {
  if (!socket) {
    socket = io(socketUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
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

export function connectSocket() {
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
  const s = socket;
  socket = null;
  s.removeAllListeners();
  s.disconnect();
}

function roomKey(kind, id) {
  return `${kind}:${id}`;
}

export function joinProjectRoom(_tokenOrProjectId, maybeProjectId) {
  // Backward compatible: joinProjectRoom(projectId) or joinProjectRoom(token, projectId)
  const projectId = maybeProjectId == null ? _tokenOrProjectId : maybeProjectId;
  const id = Number(projectId);
  if (!Number.isInteger(id) || id <= 0) return () => {};
  const s = connectSocket();
  const key = roomKey("project", id);
  roomRefs.set(key, (roomRefs.get(key) || 0) + 1);
  if (roomRefs.get(key) === 1) {
    const join = () => s.emit("joinProject", { projectId: id });
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

export function joinIssueRoom(_tokenOrIssueId, maybeIssueId) {
  const issueId = maybeIssueId == null ? _tokenOrIssueId : maybeIssueId;
  const id = Number(issueId);
  if (!Number.isInteger(id) || id <= 0) return () => {};
  const s = connectSocket();
  const key = roomKey("issue", id);
  roomRefs.set(key, (roomRefs.get(key) || 0) + 1);
  if (roomRefs.get(key) === 1) {
    const join = () => s.emit("joinIssue", { issueId: id });
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
