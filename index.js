require('dotenv').config();
process.env.TZ = 'Asia/Bangkok';

const { Client, GatewayIntentBits } = require('discord.js');
const { google } = require('googleapis');
const cron = require('node-cron');

// ===== Discord =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== Google Sheets =====
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// ===== อ่านข้อมูลชีท =====
async function getBossData() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'BossTime!A2:G100',
  });

  return res.data.values || [];
}

// ===== คำนวณเวลา =====
function getDiffMinutes(timeStr) {
  if (!timeStr) return null;

  const now = new Date();
  let [h, m] = timeStr.split(':');

  h = parseInt(h);
  m = parseInt(m);

  const target = new Date();
  target.setHours(h);
  target.setMinutes(m);
  target.setSeconds(0);

  if (target < now) {
    target.setDate(target.getDate() + 1);
  }

  return Math.floor((target - now) / 60000);
}

// ===== กันแจ้งซ้ำ =====
const notified = new Set();

// ===== ระบบแจ้งเตือน =====
async function checkBoss() {
  try {
    const channel = await client.channels.fetch(process.env.CHANNEL_ID);
    const data = await getBossData();

    data.forEach(row => {
      const boss = row[0];
      const chance = row[1];
      const time = row[4];

      if (!boss || !time) return;

      const diff = getDiffMinutes(time);
      const key = boss + time;

      console.log(`🧪 ${boss} | ${time} | diff=${diff}`);

      // ===== 15 นาที =====
      if (diff > 5 && diff <= 15 && !notified.has(key + "_15")) {
        channel.send({
          embeds: [{
            description:
`⏭️ แจ้งเตือนบอส: รอบถัดไป!

🕒 เวลา: ${time} (อีกประมาณ ${diff} นาที)
• ${boss} (${chance})`,
            color: 0x3498db
          }]
        });
        notified.add(key + "_15");
      }

      // ===== 5 นาที =====
      if (diff > 1 && diff <= 5 && !notified.has(key + "_5")) {
        channel.send({
          embeds: [{
            description:
`🔔 เหลือ 5 นาที!

🕒 ${boss} จะเกิดเวลา ${time}
(อีกประมาณ ${diff} นาที)`,
            color: 0x9b59b6
          }]
        });
        notified.add(key + "_5");
      }

      // ===== 1 นาที =====
      if (diff === 1 && !notified.has(key + "_1")) {
        channel.send({
          embeds: [{
            description:
`⏳ ใกล้แล้ว!

${boss} กำลังจะเกิดในอีก 1 นาที!`,
            color: 0xe67e22
          }]
        });
        notified.add(key + "_1");
      }

      // ===== เกิดแล้ว =====
      if (diff === 0 && !notified.has(key + "_now")) {
        channel.send({
          embeds: [{
            description:
`🔥 เกิดแล้ว!

${boss} เกิดแล้วตอนนี้! รีบไปตี!`,
            color: 0xe74c3c
          }]
        });
        notified.add(key + "_now");
      }

      // ===== รีเซ็ต =====
      if (diff > 30) {
        notified.delete(key + "_15");
        notified.delete(key + "_5");
        notified.delete(key + "_1");
        notified.delete(key + "_now");
      }
    });

  } catch (err) {
    console.error('❌ ERROR:', err);
  }
}

// ===== เช็คทุก 1 นาที =====
cron.schedule('* * * * *', () => {
  console.log('⏱️ Checking boss time...');
  checkBoss();
});

// ===== เริ่มบอท =====
client.once('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);