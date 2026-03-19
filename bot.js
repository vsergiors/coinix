require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
const express = require("express");

// ===== EXPRESS SERVER =====
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("🤖 Coinix activo ✅"));
app.listen(PORT, () => console.log(`Servidor web en puerto ${PORT}`));

// ===== CLIENT DISCORD =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ===== FUNCIONES DB JSON =====
const dbFile = "./db.json";
function loadDB() { if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify({ users: {} }, null, 2)); return JSON.parse(fs.readFileSync(dbFile, "utf8")); }
function saveDB(db) { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }
async function getUser(id) {
  const db = loadDB();
  if (!db.users[id]) { db.users[id] = { xp:0, level:1, coins:0, streak:0, reputation:0, lastDaily:null, inventory:[] }; saveDB(db); }
  return db.users[id];
}

// ===== COMANDOS SLASH =====
const commands = [
  new SlashCommandBuilder().setName('perfil').setDescription('Muestra tu perfil'),
  new SlashCommandBuilder().setName('daily').setDescription('Reclama tu recompensa diaria'),
  new SlashCommandBuilder().setName('cofre').setDescription('Abre un cofre aleatorio'),
  new SlashCommandBuilder().setName('rep').setDescription('Da reputación a alguien').addUserOption(option => option.setName('usuario').setDescription('Usuario al que dar rep').setRequired(true)),
  new SlashCommandBuilder().setName('tienda').setDescription('Muestra la tienda'),
  new SlashCommandBuilder().setName('buy').setDescription('Compra un item').addStringOption(option => option.setName('item').setDescription('Item a comprar').setRequired(true)),
  new SlashCommandBuilder().setName('inv').setDescription('Muestra tu inventario'),
  new SlashCommandBuilder().setName('rank').setDescription('Ranking de niveles')
].map(cmd => cmd.toJSON());

// ===== REGISTRAR COMANDOS GLOBAL =====
client.once("ready", async () => {
  console.log(`Bot listo como ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    console.log('Registrando comandos globales...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    console.log('Comandos slash globales registrados ✅');
  } catch (error) { console.error(error); }
});

// ===== XP AUTOMÁTICO =====
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  const db = loadDB();
  const user = await getUser(msg.author.id);

  user.xp += Math.floor(Math.random() * 10) + 5;
  if (user.xp >= user.level * 100) { user.level++; user.xp=0; msg.channel.send(`🚀 ${msg.author} sube a nivel ${user.level}`); }

  db.users[msg.author.id] = user;
  saveDB(db);
});

// ===== INTERACCIONES SLASH =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const db = loadDB();
  const user = await getUser(interaction.user.id);

  switch (interaction.commandName) {
    case 'perfil': return interaction.reply(`👤 ${interaction.user.username}\n⭐ Nivel: ${user.level}\n💰 Coins: ${user.coins}\n🔥 Streak: ${user.streak}\n🏆 Rep: ${user.reputation}`);
    case 'daily': {
      const now = new Date();
      if (user.lastDaily && now - new Date(user.lastDaily) < 86400000) return interaction.reply('⏳ Ya reclamaste hoy');
      const reward=100; user.coins+=reward; user.streak++; user.lastDaily=now.toISOString();
      db.users[interaction.user.id]=user; saveDB(db);
      return interaction.reply(`🎁 +${reward} coins | 🔥 streak ${user.streak}`);
    }
    case 'cofre': {
      const reward = Math.floor(Math.random()*200);
      user.coins += reward; db.users[interaction.user.id]=user; saveDB(db);
      return interaction.reply(`📦 Abriste un cofre: +${reward} coins`);
    }
    case 'rep': {
      const target = interaction.options.getUser('usuario');
      const tUser = await getUser(target.id); tUser.reputation++; db.users[target.id]=tUser; saveDB(db);
      return interaction.reply(`👍 +rep a ${target.username}`);
    }
    case 'tienda': return interaction.reply("🛒 Tienda:\n1. espada - 200 coins\n2. boost - 500 coins\nUsa /buy <item>");
    case 'buy': {
      const item = interaction.options.getString('item');
      if(item==='espada'){if(user.coins<200)return interaction.reply('No tienes coins');user.coins-=200;user.inventory.push('espada');}
      if(item==='boost'){if(user.coins<500)return interaction.reply('No tienes coins');user.coins-=500;user.xp+=100;}
      db.users[interaction.user.id]=user; saveDB(db); return interaction.reply('✅ Comprado');
    }
    case 'inv': return interaction.reply(`🎒 ${user.inventory.join(', ') || 'vacío'}`);
    case 'rank': {
      const top = Object.entries(db.users).sort((a,b)=>b[1].level-a[1].level).slice(0,5);
      let text="🏆 Ranking:\n"; top.forEach(([id,u],i)=>text+=`${i+1}. <@${id}> nivel ${u.level}\n`);
      return interaction.reply(text);
    }
  }
});

client.login(process.env.TOKEN);
