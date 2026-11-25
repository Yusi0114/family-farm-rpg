import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// 請確認下方雙引號內已換成你自己的 Firebase 設定值
const firebaseConfig = {
  apiKey: "AIzaSyBeq7ypv0rNCgibq8KP-v2Nr9y5H_Edz3k",
  authDomain: "family-farm-rpg-9734b.firebaseapp.com",
  projectId: "family-farm-rpg-9734b",
  storageBucket: "family-farm-rpg-9734b.firebasestorage.app",
  messagingSenderId: "1084662177305",
  appId: "1:1084662177305:web:164f370e58eb94a3e89488"
};

const app = initializeApp(firebaseConfig);

// 強制使用相容性最高的長輪詢連線，解決部分網路/瀏覽器顯示 client is offline 的問題
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});