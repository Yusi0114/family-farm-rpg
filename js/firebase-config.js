// 貼上你的 firebaseConfig 並初始化 Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBeq7ypv0rNCgibq8KP-v2Nr9y5H_Edz3k",
  authDomain: "family-farm-rpg-9734b.firebaseapp.com",
  projectId: "family-farm-rpg-9734b",
  storageBucket: "family-farm-rpg-9734b.firebasestorage.app",
  messagingSenderId: "1084662177305",
  appId: "1:1084662177305:web:164f370e58eb94a3e89488"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);