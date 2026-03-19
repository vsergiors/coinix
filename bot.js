require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const express = require("express");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== EXPRESS SERVER =====
const app = express();
const PORT = process.env.PORT || 3000;

// Endpoint simple para comprobar que el bot está corriendo
app.get("/", (req, res) => {
  res.send("🤖 Bot activo ✅");
});

app.listen(PORT, () => {
  console.log(`Servidor web escuchando en puerto ${PORT}`);
});

// ===== FUNCIONES DB JSON =====
const dbFile = "./db.json";

function loadDB() {
  return JSON.parse(fs.readFileSync(dbFile, "utf8"));
}

function saveDB(db) {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

async function getUser(id) {
  const db = loadDB();
  if (!db.users[id]) {
    db.users[id] = {
      xp: 0,
      level: 1,
      coins: 0,
      streak: 0,
      reputation: 0,
      lastDaily: null,
      inventory: []
    };
    saveDB(db);
  }
  return db.users[id];
}

// ===== READY =====
client.once("ready", () => {
  console.log(`Bot listo como ${client.user.tag}`);
});

// ===== XP + LEVEL =====
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const db = loadDB();
  const user = await getUser(msg.author.id);

  user.xp += Math.floor(Math.random() * 10) + 5;

  if (user.xp >= user.level * 100) {
    user.level++;
    user.xp = 0;
    msg.channel.send(`🚀 ${msg.author} sube a nivel ${user.level}`);
  }

  db.users[msg.author.id] = user;
  saveDB(db);
});

// ===== COMANDOS =====
client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith("!")) return;

  const args = msg.content.slice(1).split(" ");
  const cmd = args.shift().toLowerCase();

  const db = loadDB();
  const user = await getUser(msg.author.id);

  if (cmd === "perfil") {
    return msg.reply(`
👤 ${msg.author.username}
⭐ Nivel: ${user.level}
💰 Coins: ${user.coins}
🔥 Streak: ${user.streak}
🏆 Rep: ${user.reputation}
    `);
  }

  if (cmd === "daily") {
    const now = new Date();
    if (user.lastDaily && now - new Date(user.lastDaily) < 86400000)
      return msg.reply("⏳ Ya reclamaste hoy");

    const reward = 100;
    user.coins += reward;
    user.streak++;
    user.lastDaily = now.toISOString();

    db.users[msg.author.id] = user;
    saveDB(db);
    return msg.reply(`🎁 +${reward} coins | 🔥 streak ${user.streak}`);
  }

  if (cmd === "rep") {
    const target = msg.mentions.users.first();
    if (!target) return msg.reply("Menciona a alguien");

    const tUser = await getUser(target.id);
    tUser.reputation++;

    db.users[target.id] = tUser;
    saveDB(db);
    return msg.reply(`👍 +rep a ${target.username}`);
  }

  if (cmd === "cofre") {
    const reward = Math.floor(Math.random() * 200);
    user.coins += reward;
    db.users[msg.author.id] = user;
    saveDB(db);

    return msg.reply(`📦 Abriste un cofre: +${reward} coins`);
  }

  if (cmd === "tienda") {
    return msg.reply(`
🛒 Tienda:
1. espada - 200 coins
2. boost - 500 coins
usa !buy <item>
    `);
  }

  if (cmd === "buy") {
    const item = args[0];
    if (item === "espada") {
      if (user.coins < 200) return msg.reply("No tienes coins");
      user.coins -= 200;
      user.inventory.push("espada");
    }
    if (item === "boost") {
      if (user.coins < 500) return msg.reply("No tienes coins");
      user.coins -= 500;
      user.xp += 100;
    }
    db.users[msg.author.id] = user;
    saveDB(db);
    return msg.reply("✅ Comprado");
  }

  if (cmd === "inv") {
    return msg.reply(`🎒 ${user.inventory.join(", ") || "vacío"}`);
  }

  if (cmd === "rank") {
    const top = Object.entries(db.users)
      .sort((a, b) => b[1].level - a[1].level)
      .slice(0, 5);

    let text = "🏆 Ranking:\n";
    top.forEach(([id, u], i) => {
      text += `${i + 1}. <@${id}> nivel ${u.level}\n`;
    });

    msg.reply(text);
  }
});

client.login(process.env.TOKEN);