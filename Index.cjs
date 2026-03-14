// index.js - Isekai Bot — نظام مافيا + تذاكر متطور + موديريشن كامل + تفاعلات تلقائية
require('dotenv').config();
const {
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, ChannelType, PermissionsBitField,
    Collection, REST, Routes, SlashCommandBuilder, AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const GifEncoder = require('gif-encoder-2');
const axios = require('axios');
const path = require('path');

// ========== تحميل مسبق لإطارات يد الـ petpet الحقيقية ==========
const HAND_FRAMES_COUNT = 10;
const handFrameCache = [];
async function loadHandFrames() {
    if (handFrameCache.length === HAND_FRAMES_COUNT) return;
    for (let i = 0; i < HAND_FRAMES_COUNT; i++) {
        const framePath = path.resolve(__dirname, `node_modules/pet-pet-gif/img/pet${i}.gif`);
        handFrameCache.push(await loadImage(framePath));
    }
}

// ========== دالة easing سلسة ==========
function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ========== رسم خلفية طاولة خشبية ==========
function drawWoodTable(ctx, w, h) {
    const base = ctx.createLinearGradient(0, 0, w, h * 0.6);
    base.addColorStop(0,   '#C49A5A');
    base.addColorStop(0.4, '#B8833E');
    base.addColorStop(0.7, '#C8985A');
    base.addColorStop(1,   '#A87240');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // حبوب الخشب
    const grains = [
        { color: 'rgba(90,55,15,0.20)',   width: 1.2 },
        { color: 'rgba(220,175,100,0.30)', width: 0.7 },
        { color: 'rgba(70,40,10,0.15)',   width: 1.8 },
        { color: 'rgba(200,155,80,0.22)', width: 0.9 },
        { color: 'rgba(100,60,20,0.18)',  width: 1.4 },
        { color: 'rgba(240,195,120,0.28)', width: 0.6 },
        { color: 'rgba(80,48,14,0.16)',   width: 1.1 },
        { color: 'rgba(210,165,90,0.20)', width: 0.8 },
        { color: 'rgba(60,35,10,0.14)',   width: 2.0 },
        { color: 'rgba(230,185,110,0.25)', width: 0.5 },
        { color: 'rgba(95,58,18,0.19)',   width: 1.3 },
        { color: 'rgba(175,125,55,0.22)', width: 0.7 },
        { color: 'rgba(50,30,8,0.12)',    width: 1.6 },
        { color: 'rgba(245,200,130,0.18)', width: 0.6 },
        { color: 'rgba(140,90,30,0.14)',  width: 1.0 },
        { color: 'rgba(190,140,70,0.17)', width: 0.9 },
    ];
    for (let g = 0; g < grains.length; g++) {
        const { color, width } = grains[g];
        const yBase = (g / grains.length) * h;
        const wave  = Math.sin(g * 1.3) * 5;
        ctx.strokeStyle = color;
        ctx.lineWidth   = width;
        ctx.beginPath();
        ctx.moveTo(0, yBase + wave);
        ctx.bezierCurveTo(
            w * 0.25, yBase + Math.sin(g * 0.9) * 4,
            w * 0.65, yBase + Math.cos(g * 1.1) * 5,
            w,        yBase + Math.sin(g * 0.7) * 3
        );
        ctx.stroke();
    }

    // vignette
    const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.82);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // لمعة
    const sheen = ctx.createLinearGradient(0, 0, 0, h * 0.35);
    sheen.addColorStop(0,   'rgba(255,255,255,0.18)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    sheen.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);
}

// ========== دالة رسم دائرة مقصوصة ==========
function drawCircleImage(ctx, img, cx, cy, rx, ry) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, cx - rx, cy - ry, rx * 2, ry * 2);
    ctx.restore();
}

// ========== توليد صورة PetPet واقعية (يد + طاولة) ==========
async function createPetpetGif(targetUser) {
    const RES    = 160;  // دقة أعلى
    const FRAMES = 12;   // إطارات أكثر للسلاسة

    await loadHandFrames();

    const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    let avatarImg;
    try {
        const res = await axios.get(avatarUrl, { responseType: 'arraybuffer', timeout: 10000 });
        avatarImg = await loadImage(Buffer.from(res.data));
    } catch { return null; }

    const encoder = new GifEncoder(RES, RES);
    encoder.setDelay(45);  // أسرع قليلاً للمزيد من الواقعية
    encoder.setRepeat(0);
    encoder.setQuality(10);
    encoder.start();

    for (let i = 0; i < FRAMES; i++) {
        const canvas = createCanvas(RES, RES);
        const ctx    = canvas.getContext('2d');

        // ===== 1) خلفية الطاولة الخشبية =====
        drawWoodTable(ctx, RES, RES);

        // ===== 2) حساب منحنى الضغط =====
        // t يتراوح من 0 إلى 1 ويعود إلى 0 (نصف دورة)
        const tRaw    = i / FRAMES;
        const cycle   = Math.sin(tRaw * Math.PI * 2);       // -1 إلى 1
        const press   = Math.max(0, cycle);                  // 0 إلى 1 (فقط النصف النزولي)
        const pressE  = easeInOutSine(press);                // منحنى أملس

        // نسبة الضغط: 0 = لا ضغط، 1 = أقصى ضغط
        const squishAmt = pressE * 0.34;  // تسطيح عمودي أكثر واقعية

        // أبعاد الأفاتار مع الضغط
        const baseSizeRatio = 0.72;
        const avRX = (baseSizeRatio / 2 + squishAmt * 0.12) * RES;  // توسع أفقي خفيف
        const avRY = (baseSizeRatio / 2 - squishAmt * 0.5)  * RES;  // تسطيح عمودي

        // موضع المركز — يرتفع قليلاً عند الضغط (لأن الطاولة صلبة)
        const avCX = RES * 0.5 + 4;
        const avCY = RES * 0.78 - squishAmt * RES * 0.38 + avRY;

        // ===== 3) ظل الأفاتار على الطاولة =====
        ctx.save();
        const shadowOpacity = 0.15 + pressE * 0.20;  // الظل يتعمق عند الضغط
        const shadowScaleX  = 1.0 + squishAmt * 0.5;
        const shadowScaleY  = 0.22 - squishAmt * 0.08;
        ctx.fillStyle = `rgba(0,0,0,${shadowOpacity})`;
        ctx.beginPath();
        ctx.ellipse(
            avCX, RES * 0.95,
            avRX * shadowScaleX, avRY * shadowScaleY,
            0, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();

        // ===== 4) توهج ناعم خلف الأفاتار =====
        ctx.save();
        const glow = ctx.createRadialGradient(avCX, avCY, avRX * 0.3, avCX, avCY, avRX * 1.4);
        glow.addColorStop(0, 'rgba(255,220,180,0.18)');
        glow.addColorStop(1, 'rgba(255,200,150,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(avCX, avCY, avRX * 1.4, avRY * 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // ===== 5) رسم الأفاتار (دائري مقصوص) =====
        drawCircleImage(ctx, avatarImg, avCX, avCY, avRX, avRY);

        // ===== 6) حدود الأفاتار مع توهج =====
        ctx.save();
        // توهج خارجي
        ctx.shadowColor   = 'rgba(255,255,255,0.5)';
        ctx.shadowBlur    = 4;
        ctx.strokeStyle   = `rgba(255,255,255,${0.55 - pressE * 0.15})`;
        ctx.lineWidth     = 2.2;
        ctx.beginPath();
        ctx.ellipse(avCX, avCY, avRX, avRY, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // ===== 7) رسم إطار اليد الحقيقية =====
        // استخدام إطار مختلف بناءً على موقع اليد
        const handFrameIndex = Math.floor((i / FRAMES) * HAND_FRAMES_COUNT) % HAND_FRAMES_COUNT;
        const handFrame = handFrameCache[handFrameIndex];

        // ظل اليد على الأفاتار
        ctx.save();
        ctx.globalAlpha      = 0.18 * pressE;
        ctx.filter           = 'blur(3px)';
        ctx.fillStyle        = 'rgba(0,0,0,0.5)';
        ctx.drawImage(handFrame, 2, 3, RES, RES);
        ctx.restore();

        // اليد الفعلية
        ctx.drawImage(handFrame, 0, 0, RES, RES);

        encoder.addFrame(ctx);
    }

    encoder.finish();
    return encoder.out.getData();
}

// ===== كاش GIF الضريح الخبيث =====
let shrineCachedGif = null;
async function getShrineGif() {
    if (shrineCachedGif) return shrineCachedGif;
    try {
        const res = await axios.get(
            'https://cdn.discordapp.com/attachments/1480646829019238493/1481425266365432019/image0.gif',
            { responseType: 'arraybuffer', timeout: 15000 }
        );
        shrineCachedGif = Buffer.from(res.data);
        return shrineCachedGif;
    } catch {
        return null;
    }
}

// ========== معالجة الأخطاء العامة ==========
process.on('unhandledRejection', err => console.error('unhandledRejection:', err?.message));
process.on('uncaughtException',  err => console.error('uncaughtException:',  err?.message));

// ========== العميل ==========
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers
    ]
});

// ========== الإعدادات الثابتة ==========
const config = {
    prefix: "!",
    tickets: {
        maxTicketsPerUser: 3,
        types: [
            { id: "support",  name: "دعم فني",   emoji: "🎫" },
            { id: "inquiry",  name: "استفسار",    emoji: "❓" },
            { id: "report",   name: "بلاغ",       emoji: "🚨" }
        ]
    },
    mafia: {
        minPlayers: 4,
        maxPlayers: 12,
        nightDuration: 20000,
        dayDuration:   30000,
        voteDuration:  20000,
        countdown:     60
    }
};

// ========== قاعدة البيانات (JSON) ==========
const DB_FILE = './database.json';
let db = { tickets: {}, guildConfig: {}, warnings: {} };
const mafiaGames = {};

if (fs.existsSync(DB_FILE)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        db.tickets     = loaded.tickets     || {};
        db.guildConfig = loaded.guildConfig || {};
        db.warnings    = loaded.warnings    || {};
    } catch (e) { console.error("خطأ في قراءة قاعدة البيانات:", e); }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ========== دوال مساعدة عامة ==========

// تحليل نص إيموجي مخصص أو عادي
function parseEmoji(str) {
    if (!str) return null;
    const m = str.trim().match(/^<(a?):(\w+):(\d+)>$/);
    if (m) return { animated: m[1] === 'a', name: m[2], id: m[3] };
    return str.trim();
}

// بناء embed خطأ
function errEmbed(msg) {
    return new EmbedBuilder().setColor('Red').setDescription(`❌ ${msg}`);
}

// بناء embed نجاح
function okEmbed(msg) {
    return new EmbedBuilder().setColor('Green').setDescription(`✅ ${msg}`);
}

// تحويل الدقائق إلى نص عربي
function minutesToAr(min) {
    if (min < 60) return `${min} دقيقة`;
    if (min < 1440) return `${Math.floor(min/60)} ساعة`;
    return `${Math.floor(min/1440)} يوم`;
}

// إرسال للوق
async function sendLog(guild, embedData) {
    const cfg = db.guildConfig?.[guild.id];
    if (!cfg?.logChannelId) return;
    const ch = guild.channels.cache.get(cfg.logChannelId);
    if (ch) ch.send({ embeds: [embedData] }).catch(() => {});
}

// توليد ترانسكريبت نصي للتذكرة
async function generateTranscript(channel) {
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const sorted = [...messages.values()].reverse();
        const lines = sorted.map(m => {
            const time = new Date(m.createdTimestamp).toLocaleString('ar-EG');
            const content = m.content || (m.embeds.length ? '[Embed]' : '[ملف]');
            return `[${time}] ${m.author.tag}: ${content}`;
        });
        return lines.join('\n');
    } catch { return 'تعذّر جلب الرسائل.'; }
}

// ========== معالجة التفاعل التلقائي ==========
async function handleAutoReact(message) {
    if (message.author.bot || !message.guild) return;
    const cfg = db.guildConfig?.[message.guild.id];
    if (!cfg?.reactChannels) return;

    const emojiStr = cfg.reactChannels[message.channel.id];
    if (!emojiStr) return;

    try {
        const parsed = parseEmoji(emojiStr);
        if (typeof parsed === 'object') {
            // إيموجي مخصص من السيرفر
            const guildEmoji = message.guild.emojis.cache.get(parsed.id);
            if (guildEmoji) {
                await message.react(guildEmoji);
            } else {
                // محاولة باستخدام الصيغة المباشرة
                await message.react(`${parsed.name}:${parsed.id}`);
            }
        } else {
            // إيموجي يونيكود عادي
            await message.react(parsed);
        }
    } catch (err) {
        console.error(`خطأ في التفاعل التلقائي: ${err.message}`);
    }
}

// ========== كلاس إدارة التذاكر ==========
class TicketManager {
    constructor(guildId) {
        this.guildId = guildId;
        if (!db.tickets[guildId]) db.tickets[guildId] = {};
    }

    async create(user, type) {
        const guild = client.guilds.cache.get(this.guildId);
        if (!guild) throw new Error('السيرفر غير موجود');

        const openCount = Object.values(db.tickets[this.guildId])
            .filter(t => t.userId === user.id && t.status === 'open').length;
        if (openCount >= config.tickets.maxTicketsPerUser)
            throw new Error(`لا يمكنك فتح أكثر من ${config.tickets.maxTicketsPerUser} تذاكر مفتوحة`);

        const guildCfg = db.guildConfig?.[this.guildId] || {};
        const counter = (guildCfg.ticketCounter || 0) + 1;
        if (!db.guildConfig[this.guildId]) db.guildConfig[this.guildId] = {};
        db.guildConfig[this.guildId].ticketCounter = counter;

        const ticketId = uuidv4().slice(0, 6);
        const template = guildCfg.ticketNameTemplate || 'تذكرة-{رقم}';
        const channelName = template
            .replace('{رقم}', counter)
            .replace('{user}', user.username.toLowerCase().replace(/[^a-z0-9]/g, ''))
            .replace('{نوع}', type.name)
            .toLowerCase().replace(/\s+/g, '-').slice(0, 100);

        const perms = [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.id,  allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
        ];
        for (const rId of [guildCfg.staffRole1, guildCfg.staffRole2].filter(Boolean)) {
            const r = guild.roles.cache.get(rId);
            if (r) perms.push({ id: r.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
        }

        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: guildCfg.ticketCategoryId || null,
            permissionOverwrites: perms
        });

        db.tickets[this.guildId][ticketId] = {
            userId: user.id,
            channelId: channel.id,
            status: 'open',
            staff: null,
            createdAt: Date.now(),
            type: type.name,
            counter
        };
        saveDB();

        const mentionStr = [guildCfg.mention1, guildCfg.mention2].filter(Boolean)
            .map(id => guild.roles.cache.has(id) ? `<@&${id}>` : `<@${id}>`).join(' ') || '@here';

        const embed = new EmbedBuilder()
            .setTitle(`📩 ${guildCfg.ticketTitle || 'تذكرة جديدة'}: ${type.name} #${counter}`)
            .setDescription(`مرحباً ${user}، سيتم الرد عليك في أقرب وقت ممكن.\n\nاستخدم الأزرار أدناه لإدارة التذكرة.`)
            .setColor('Green')
            .addFields(
                { name: '👤 صاحب التذكرة', value: `${user}`, inline: true },
                { name: '📂 النوع',          value: type.name,  inline: true },
                { name: '🔢 الرقم',          value: `#${counter}`, inline: true }
            )
            .setFooter({ text: `فُتحت في: ${new Date().toLocaleString('ar-EG')}` });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`claim_${ticketId}`).setLabel('استلام').setEmoji('🛄').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`close_${ticketId}`).setLabel('إغلاق').setEmoji('🔒').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`transcript_${ticketId}`).setLabel('ترانسكريبت').setEmoji('📄').setStyle(ButtonStyle.Secondary)
        );

        await channel.send({ content: mentionStr, embeds: [embed], components: [row] });

        await sendLog(guild, new EmbedBuilder()
            .setTitle('📩 تم فتح تذكرة')
            .setColor('Green')
            .addFields(
                { name: 'صاحب التذكرة', value: `${user} (${user.id})`, inline: true },
                { name: 'النوع',         value: type.name,              inline: true },
                { name: 'القناة',        value: `${channel}`,           inline: true }
            )
            .setTimestamp()
        );

        return channel;
    }

    claim(ticketId, staffId) {
        const t = db.tickets[this.guildId]?.[ticketId];
        if (!t) throw new Error('التذكرة غير موجودة');
        if (t.staff) throw new Error('تم استلام هذه التذكرة مسبقاً');
        t.staff = staffId;
        saveDB();
    }

    async close(ticketId, closedBy, guild) {
        const t = db.tickets[this.guildId]?.[ticketId];
        if (!t) throw new Error('التذكرة غير موجودة');
        if (t.status === 'closed') throw new Error('التذكرة مغلقة بالفعل');
        t.status = 'closed';
        t.closedAt = Date.now();
        t.closedBy = closedBy;
        saveDB();

        const channel = guild.channels.cache.get(t.channelId);
        if (channel) {
            await channel.permissionOverwrites.edit(t.userId, {
                SendMessages: false
            }).catch(() => {});

            const transcript = await generateTranscript(channel);
            const buf = Buffer.from(transcript, 'utf8');
            const attachment = new AttachmentBuilder(buf, { name: `transcript-${ticketId}.txt` });

            const logCfg = db.guildConfig?.[this.guildId];
            if (logCfg?.logChannelId) {
                const logCh = guild.channels.cache.get(logCfg.logChannelId);
                if (logCh) {
                    await logCh.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🔒 تذكرة مُغلقة')
                            .setColor('Orange')
                            .addFields(
                                { name: 'صاحب التذكرة', value: `<@${t.userId}>`, inline: true },
                                { name: 'أُغلق بواسطة', value: `<@${closedBy}>`, inline: true },
                                { name: 'النوع',         value: t.type,           inline: true }
                            )
                            .setTimestamp()
                        ],
                        files: [attachment]
                    }).catch(() => {});
                }
            }

            const owner = await guild.members.fetch(t.userId).catch(() => null);
            if (owner) {
                const rateRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`rate_1_${ticketId}`).setLabel('⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`rate_2_${ticketId}`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`rate_3_${ticketId}`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`rate_4_${ticketId}`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`rate_5_${ticketId}`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Success)
                );
                owner.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('⭐ قيّم تجربتك')
                        .setDescription('كيف كانت تجربتك مع الدعم؟ اختر عدد النجوم.')
                        .setColor('Gold')
                    ],
                    components: [rateRow]
                }).catch(() => {});
            }
        }
    }

    async reopen(ticketId, guild) {
        const t = db.tickets[this.guildId]?.[ticketId];
        if (!t) throw new Error('التذكرة غير موجودة');
        if (t.status === 'open') throw new Error('التذكرة مفتوحة بالفعل');
        t.status = 'open';
        t.closedAt = null;
        saveDB();

        const channel = guild.channels.cache.get(t.channelId);
        if (channel) {
            await channel.permissionOverwrites.edit(t.userId, {
                SendMessages: true
            }).catch(() => {});
        }
    }

    async deleteTicket(ticketId, guild) {
        const t = db.tickets[this.guildId]?.[ticketId];
        const channel = t ? guild.channels.cache.get(t.channelId) : null;

        if (channel) {
            const transcript = await generateTranscript(channel);
            const buf = Buffer.from(transcript, 'utf8');
            const attachment = new AttachmentBuilder(buf, { name: `transcript-${ticketId}.txt` });
            const logCfg = db.guildConfig?.[this.guildId];
            if (logCfg?.logChannelId) {
                const logCh = guild.channels.cache.get(logCfg.logChannelId);
                if (logCh && t) {
                    await logCh.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('⛔ تذكرة محذوفة')
                            .setColor('Red')
                            .addFields(
                                { name: 'صاحب التذكرة', value: `<@${t.userId}>`, inline: true },
                                { name: 'النوع',         value: t.type || '؟',   inline: true }
                            )
                            .setTimestamp()
                        ],
                        files: [attachment]
                    }).catch(() => {});
                }
            }
            await channel.delete().catch(() => {});
        }

        if (t) delete db.tickets[this.guildId][ticketId];
        saveDB();
    }

    get(ticketId) { return db.tickets[this.guildId]?.[ticketId]; }
}

// ========== بيانات أدوار المافيا ==========
const MAFIA_ROLES = {
    مافيا: {
        emoji: '🔫',
        color: 0xC0392B,
        colorHex: '#C0392B',
        image: 'https://cdn.discordapp.com/attachments/1468556905990328487/1482417378993377453/be1c53c0-1fc2-11f1-b0b8-4b2eb4627d49.png?ex=69b6e045&is=69b58ec5&hm=9a4f8bbfb7330f7c1bed13a550d1806f13a6bb7d67ac099b76186da0acdc1eb4&',
        description: 'أنت عضو **مافيا** 🔫\nمهمتك القضاء على المدنيين.\nكل ليلة تختار ضحية للقتل.\nظهِر بريئاً في النهار واخدع الجميع!'
    },
    طبيب: {
        emoji: '💊',
        color: 0x27AE60,
        colorHex: '#27AE60',
        image: 'https://cdn.discordapp.com/attachments/1475544730602311874/1482414162876432544/3f3e4cc0-1fc2-11f1-b6e7-d9a6c68f01a6.png?ex=69b6dd46&is=69b58bc6&hm=53c643cf0fd26d62653654c675fa6e29f378db4e3e6a40ac0541c53ab891b3b0&',
        description: 'أنت **الطبيب** 💊\nكل ليلة تختار شخصاً لحمايته من قتل المافيا.\nيمكنك حماية نفسك أيضاً!\nساعد المدنيين على البقاء.'
    },
    مواطن: {
        emoji: '👤',
        color: 0x3498DB,
        colorHex: '#3498DB',
        image: 'https://cdn.discordapp.com/attachments/1475544730602311874/1482416428647710792/f1d79530-1fc2-11f1-8ee1-a722bc1b73df.png?ex=69b6df62&is=69b58de2&hm=bfb6852428dd8924554a071d7c239537b9f816e03d08f1fdfa7d8cb4bf4586f4&',
        description: 'أنت **مواطن** 👤\nلا تمتلك قدرات خاصة، لكن صوتك قوي!\nناقش وحلل واكشف المافيا بالتصويت.'
    },
    مهرج: {
        emoji: '🃏',
        color: 0xF39C12,
        colorHex: '#F39C12',
        image: 'https://cdn.discordapp.com/attachments/1475544730602311874/1482416443076382862/7f67aa20-1fc3-11f1-8ee1-a722bc1b73df.png?ex=69b6df65&is=69b58de5&hm=1f056d0a9abe7a13fb236ca2e3e01360bb4ca13c2b9028eb286430228e7ce57f&',
        description: 'أنت **المهرج** 🃏\nأنت لا تنتمي لأي فريق!\n**هدفك الوحيد: أن يُصوَّت لإعدامك في النهار.**\nإذا قُتلت بالليل — تخسر.\nإذا أُعدمت بالتصويت — **تفوز فوراً!**\nاخدع الجميع وأجعلهم يشتبهون بك!'
    }
};

const MAFIA_START_IMAGE = 'https://cdn.discordapp.com/attachments/1475544730602311874/1482413940007899199/a5923e10-1fc1-11f1-8c6f-b380f9f563fd.png?ex=69b6dd11&is=69b58b91&hm=1ca33b4827a4f128ce53958636a7ac6a786931f08735655c58fc083a625e86eb&';

// ========== توليد صورة نتيجة المافيا ==========
async function generateWinImage(allPlayerIds, roles, guild, winnerType) {
    const isWinner = (role) => {
        if (winnerType === 'مافيا')   return role === 'مافيا';
        if (winnerType === 'مدنيون') return role === 'مواطن' || role === 'طبيب';
        if (winnerType === 'مهرج')   return role === 'مهرج';
        return false;
    };

    const winners = allPlayerIds.filter(id => isWinner(roles[id]));
    const losers  = allPlayerIds.filter(id => !isWinner(roles[id]));

    const AVATAR_D   = 80;
    const SLOT_W     = 110;
    const SLOT_H     = AVATAR_D + 58;
    const MAX_ROW    = 7;
    const PAD        = 35;
    const HEADER_H   = 75;
    const SEC_TITLE  = 48;
    const SEC_GAP    = 24;

    const maxPerRow  = Math.min(Math.max(winners.length, losers.length, 1), MAX_ROW);
    const canvasW    = Math.max(520, PAD * 2 + maxPerRow * SLOT_W);
    const winRows    = Math.ceil(winners.length / MAX_ROW) || 1;
    const loseRows   = Math.ceil(losers.length  / MAX_ROW) || 1;
    const canvasH    = HEADER_H + SEC_TITLE + winRows * SLOT_H + SEC_GAP + SEC_TITLE + loseRows * SLOT_H + PAD;

    const canvas = createCanvas(canvasW, canvasH);
    const ctx    = canvas.getContext('2d');

    // خلفية متدرجة داكنة
    const bg = ctx.createLinearGradient(0, 0, canvasW, canvasH);
    bg.addColorStop(0, '#0d1b2a');
    bg.addColorStop(1, '#1c2e42');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // خطوط زخرفية
    for (let i = 0; i < canvasH; i += 40) {
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvasW, i);
        ctx.stroke();
    }

    // عنوان الصفحة
    ctx.textAlign    = 'center';
    ctx.fillStyle    = '#FFD700';
    ctx.font         = 'bold 34px Arial';
    ctx.fillText('نتيجة اللعبة', canvasW / 2, 50);

    // خط فاصل ذهبي
    const grad1 = ctx.createLinearGradient(PAD, 0, canvasW - PAD, 0);
    grad1.addColorStop(0, 'rgba(255,215,0,0)');
    grad1.addColorStop(0.5, '#FFD700');
    grad1.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.strokeStyle = grad1;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD, HEADER_H - 8);
    ctx.lineTo(canvasW - PAD, HEADER_H - 8);
    ctx.stroke();

    // دالة رسم مجموعة لاعبين
    const drawGroup = async (group, startY, winner) => {
        for (let i = 0; i < group.length; i++) {
            const row    = Math.floor(i / MAX_ROW);
            const col    = i % MAX_ROW;
            const rowLen = Math.min(group.length - row * MAX_ROW, MAX_ROW);
            const rowX0  = (canvasW - rowLen * SLOT_W) / 2;
            const cx     = rowX0 + col * SLOT_W + SLOT_W / 2;
            const cy     = startY + row * SLOT_H + AVATAR_D / 2;

            const pid    = group[i];
            const role   = roles[pid];
            const rd     = MAFIA_ROLES[role] || { emoji: '❓', colorHex: '#888', color: 0x888888 };
            const member = guild.members.cache.get(pid);
            const name   = (member?.user.username || '؟').slice(0, 11);

            // حلقة الهالة
            ctx.save();
            if (winner) {
                const glow = ctx.createRadialGradient(cx, cy, AVATAR_D / 2 - 2, cx, cy, AVATAR_D / 2 + 10);
                glow.addColorStop(0, '#FFD700AA');
                glow.addColorStop(1, 'rgba(255,215,0,0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(cx, cy, AVATAR_D / 2 + 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth   = 3;
            } else {
                ctx.strokeStyle = '#E74C3C';
                ctx.lineWidth   = 2;
                ctx.globalAlpha = 0.6;
            }
            ctx.beginPath();
            ctx.arc(cx, cy, AVATAR_D / 2 + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // صورة الأفاتار
            try {
                const avatarUrl = member?.user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true });
                const res = await axios.get(avatarUrl, { responseType: 'arraybuffer', timeout: 6000 });
                const img = await loadImage(Buffer.from(res.data));
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, AVATAR_D / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(img, cx - AVATAR_D / 2, cy - AVATAR_D / 2, AVATAR_D, AVATAR_D);
                ctx.restore();
            } catch {
                ctx.fillStyle = rd.colorHex;
                ctx.beginPath();
                ctx.arc(cx, cy, AVATAR_D / 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // تعتيم للخاسرين
            if (!winner) {
                ctx.save();
                ctx.globalAlpha = 0.45;
                ctx.fillStyle   = '#000';
                ctx.beginPath();
                ctx.arc(cx, cy, AVATAR_D / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // إيموجي الدور
            const textBase = cy + AVATAR_D / 2 + 5;
            ctx.font      = '20px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(rd.emoji, cx, textBase + 18);

            // اسم الدور
            ctx.font      = 'bold 12px Arial';
            ctx.fillStyle = rd.colorHex;
            ctx.fillText(role, cx, textBase + 34);

            // اسم اللاعب
            ctx.font      = '11px Arial';
            ctx.fillStyle = winner ? '#D0D0D0' : '#888888';
            ctx.fillText(name, cx, textBase + 48);
        }
        return startY + Math.ceil(group.length / MAX_ROW) * SLOT_H;
    };

    // قسم الفائزين
    ctx.font      = 'bold 22px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 الفائزون', canvasW / 2, HEADER_H + 30);

    let nextY = await drawGroup(winners, HEADER_H + SEC_TITLE, true);

    // خط فاصل بين القسمين
    nextY += SEC_GAP / 2;
    const grad2 = ctx.createLinearGradient(PAD, 0, canvasW - PAD, 0);
    grad2.addColorStop(0, 'rgba(231,76,60,0)');
    grad2.addColorStop(0.5, '#E74C3C');
    grad2.addColorStop(1, 'rgba(231,76,60,0)');
    ctx.strokeStyle = grad2;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, nextY);
    ctx.lineTo(canvasW - PAD, nextY);
    ctx.stroke();
    nextY += SEC_GAP / 2;

    // قسم الخاسرين
    ctx.font      = 'bold 22px Arial';
    ctx.fillStyle = '#E74C3C';
    ctx.textAlign = 'center';
    ctx.fillText('💀 الخاسرون', canvasW / 2, nextY + 30);

    await drawGroup(losers, nextY + SEC_TITLE, false);

    return canvas.toBuffer('image/png');
}

// ========== كلاس لعبة المافيا ==========
class MafiaGame {
    constructor(guildId, channel) {
        this.guildId    = guildId;
        this.channel    = channel;
        this.players    = [];
        this.alive      = [];
        this.roles      = {};
        this.status     = 'waiting';
        this.votes      = {};
        this.nightKill  = null;
        this.doctorSave = null;
        this.timers     = [];
        this.panelMessage    = null;
        this.revealMessage   = null;
        this.countdown  = config.mafia.countdown;
        this.interval   = null;
    }

    // ===== لوبي الانتظار =====
    async startWaiting() {
        const embed = new EmbedBuilder()
            .setTitle('🎲 لعبة المافيا')
            .setDescription(`انضم للعبة بالضغط على الزر!\nالبدء بعد **${this.countdown}** ثانية.`)
            .setImage(MAFIA_START_IMAGE)
            .setColor(0x9B59B6)
            .addFields(
                { name: '🔫 المافيا',  value: 'تقتل ليلاً وتتظاهر نهاراً',  inline: true },
                { name: '💊 الطبيب',   value: 'يحمي لاعباً كل ليلة',         inline: true },
                { name: '🃏 المهرج',   value: 'يفوز إذا أُعدم بالتصويت',     inline: true },
                { name: '👤 المواطن',  value: 'يصوّت لكشف المافيا',          inline: true }
            )
            .setFooter({ text: `الحد الأدنى: ${config.mafia.minPlayers} لاعبين` });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mafia_join').setLabel('انضمام').setEmoji('➕').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('mafia_leave').setLabel('مغادرة').setEmoji('➖').setStyle(ButtonStyle.Danger)
        );

        this.panelMessage = await this.channel.send({ embeds: [embed], components: [row] });

        this.interval = setInterval(() => {
            this.countdown--;
            if (this.countdown % 10 === 0 || this.countdown <= 5) this.updatePanel();
            if (this.countdown <= 0) {
                clearInterval(this.interval);
                this.startGame();
            }
        }, 1000);
    }

    async updatePanel() {
        if (!this.panelMessage) return;
        const list = this.players.map(id => `<@${id}>`).join('\n') || 'لا يوجد أحد بعد';
        await this.panelMessage.edit({
            embeds: [new EmbedBuilder()
                .setTitle('🎲 لعبة المافيا — انتظار')
                .setDescription(`البدء بعد **${this.countdown}** ثانية`)
                .setImage(MAFIA_START_IMAGE)
                .addFields({ name: `👥 اللاعبون (${this.players.length})`, value: list })
                .setColor(0x9B59B6)
            ]
        }).catch(() => {});
    }

    // ===== توزيع الأدوار وبدء اللعبة =====
    async startGame() {
        if (this.players.length < config.mafia.minPlayers) {
            await this.channel.send('❌ لم يكتمل العدد المطلوب، تم إلغاء اللعبة.');
            this.endGame();
            return;
        }

        this.status = 'night';
        this.alive  = [...this.players];

        // توزيع الأدوار
        const pool = [];
        const mafiaCount = Math.max(1, Math.floor(this.players.length / 4));
        for (let i = 0; i < mafiaCount; i++) pool.push('مافيا');
        pool.push('طبيب');
        if (this.players.length >= 5) pool.push('مهرج');
        while (pool.length < this.players.length) pool.push('مواطن');

        const shuffled = [...this.players].sort(() => Math.random() - 0.5);
        shuffled.forEach((id, i) => { this.roles[id] = pool[i]; });

        // إخبار المافيا بزملائهم والمهرج عبر DM
        const mafiaIds = this.players.filter(id => this.roles[id] === 'مافيا');
        const jesterId = this.players.find(id => this.roles[id] === 'مهرج');
        const getName  = id => this.channel.guild.members.cache.get(id)?.user.username || 'لاعب';

        for (const mId of mafiaIds) {
            const member = await this.channel.guild.members.fetch(mId).catch(() => null);
            if (!member) continue;
            const teammates  = mafiaIds.filter(i => i !== mId).map(i => `🔫 ${getName(i)}`).join('\n') || 'أنت المافيا الوحيد!';
            const jesterLine = jesterId ? `\n\n🃏 **المهرج هو: ${getName(jesterId)}** — لا تقتله بالليل!` : '';
            await member.send({
                embeds: [new EmbedBuilder()
                    .setTitle('🔫 سرّ المافيا')
                    .setDescription(`**زملاؤك في المافيا:**\n${teammates}${jesterLine}`)
                    .setColor(0xC0392B)
                    .setFooter({ text: 'هذه المعلومة سرية — لا تكشفها!' })
                ]
            }).catch(() => {});
        }

        // إحصاء الأدوار للعرض
        const roleCount = pool.reduce((acc, r) => { acc[r] = (acc[r]||0)+1; return acc; }, {});
        const roleDesc  = Object.entries(roleCount)
            .map(([r, n]) => `${MAFIA_ROLES[r].emoji} **${r}** × ${n}`)
            .join('  •  ');

        // رسالة بدء اللعبة مع زر "اعرف دورك"
        const revealRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('mafia_reveal_role')
                .setLabel('إظهار دورك 🌐)
                .setStyle(ButtonStyle.Primary)
        );

        this.revealMessage = await this.channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🎲 بدأت اللعبة!')
                .setDescription(`تم توزيع الأدوار على **${this.players.length}** لاعبين.\n**اضغط على الزر أدناه لمعرفة دورك — الرسالة ستظهر لك أنت فقط!**\n\n${roleDesc}`)
                .setColor(0x9B59B6)
                .setFooter({ text: 'يمكنك الضغط في أي وقت خلال اللعبة لتذكر دورك' })
            ],
            components: [revealRow]
        });

        setTimeout(() => this.startNight(), 4000);
    }

    buildRows(buttons) {
        const rows = [];
        for (let i = 0; i < buttons.length && rows.length < 5; i += 5)
            rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        return rows;
    }

    // ===== الليل =====
    async startNight() {
        const winner = this.checkWin();
        if (winner) { await this.announceWin(winner); return; }

        this.nightKill  = null;
        this.doctorSave = null;

        const mafiaList = this.alive.filter(id => this.roles[id] === 'مافيا');
        const doctor    = this.alive.find(id => this.roles[id] === 'طبيب');
        const getName   = id => this.channel.guild.members.cache.get(id)?.user.username || 'لاعب';

        await this.channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🌙 حلّ الليل...')
                .setDescription('تحرّكت المافيا في الظلام...\nتفقد رسائلك الخاصة إذا كان لديك دور ليلي.')
                .setColor(0x2C3E50)
            ]
        });

        // رسائل المافيا (DM)
        for (const mId of mafiaList) {
            const member = await this.channel.guild.members.fetch(mId).catch(() => null);
            if (!member) continue;
            const targets = this.alive.filter(id => this.roles[id] !== 'مافيا').slice(0, 25);
            const btns    = targets.map(id =>
                new ButtonBuilder().setCustomId(`mafia_kill_${id}`).setLabel(getName(id)).setStyle(ButtonStyle.Danger)
            );
            await member.send({
                embeds: [new EmbedBuilder()
                    .setTitle('🔪 اختر ضحيتك الليلة')
                    .setDescription('من تريد قتله؟ اختر بحذر...')
                    .setColor(0xC0392B)
                ],
                components: this.buildRows(btns)
            }).catch(() => {});
        }

        // رسالة الطبيب (DM)
        if (doctor) {
            const member = await this.channel.guild.members.fetch(doctor).catch(() => null);
            if (member) {
                const btns = [
                    ...this.alive.slice(0, 24).map(id =>
                        new ButtonBuilder().setCustomId(`doctor_save_${id}`).setLabel(getName(id)).setStyle(ButtonStyle.Success)
                    ),
                    new ButtonBuilder().setCustomId('doctor_save_none').setLabel('لا أحد').setStyle(ButtonStyle.Secondary)
                ];
                await member.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('💊 من تحمي الليلة؟')
                        .setDescription('اختر لاعباً لحمايته من قتل المافيا.')
                        .setColor(0x27AE60)
                    ],
                    components: this.buildRows(btns)
                }).catch(() => {});
            }
        }

        setTimeout(() => this.startDay(), config.mafia.nightDuration);
    }

    // ===== النهار =====
    async startDay() {
        const winner = this.checkWin();
        if (winner) { await this.announceWin(winner); return; }

        let killed = this.nightKill;
        if (killed && this.doctorSave === killed) {
            killed = null;
            await this.channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('💊 معجزة طبية!')
                    .setDescription('حاولت المافيا قتل أحدهم... لكن الطبيب كان هناك!\n**لم يمت أحد هذه الليلة.**')
                    .setColor(0x27AE60)
                ]
            });
        } else if (killed) {
            this.alive = this.alive.filter(id => id !== killed);
            const km   = await this.channel.guild.members.fetch(killed).catch(() => null);
            const rd   = MAFIA_ROLES[this.roles[killed]];
            await this.channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('🔪 قتيل الليلة')
                    .setDescription(`وُجد **${km?.user.username || 'لاعب'}** ميتاً في الصباح...\nكان دوره: ${rd.emoji} **${this.roles[killed]}**`)
                    .setThumbnail(rd.image)
                    .setColor(0xE74C3C)
                ]
            });
        } else {
            await this.channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('🌟 ليلة هادئة')
                    .setDescription('لم يمت أحد هذه الليلة.')
                    .setColor(0xF39C12)
                ]
            });
        }

        const winner2 = this.checkWin();
        if (winner2) { await this.announceWin(winner2); return; }

        this.status = 'day';
        this.votes  = {};

        const getName = id => this.channel.guild.members.cache.get(id)?.user.username || 'لاعب';

        // أزرار التصويت — كل زر يظهر اسم اللاعب فقط (لا يكشف دوره)
        const vbtns = [
            ...this.alive.slice(0, 24).map(id =>
                new ButtonBuilder()
                    .setCustomId(`vote_${id}`)
                    .setLabel(getName(id))
                    .setStyle(ButtonStyle.Primary)
            ),
            new ButtonBuilder().setCustomId('vote_none').setLabel('امتناع').setStyle(ButtonStyle.Secondary)
        ];

        // إحصاء من صوّت حتى الآن (يُحدَّث بعد كل تصويت)
        const aliveList = this.alive.map(id => `👤 ${getName(id)}`).join('\n');

        await this.channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🌞 النهار — وقت التصويت')
                .setDescription('ناقشوا وصوّتوا لإعدام المشتبه به!\n⚠️ **تحذير:** قد يكون المهرج بينكم — فكّروا مليّاً!')
                .addFields({ name: `👥 الأحياء (${this.alive.length})`, value: aliveList })
                .setColor(0xF1C40F)
                .setFooter({ text: `الوقت المتاح: ${config.mafia.voteDuration / 3000} ثانية` })
            ],
            components: this.buildRows(vbtns)
        });

        setTimeout(() => this.endVoting(), config.mafia.voteDuration);
    }

    // ===== نهاية التصويت =====
    async endVoting() {
        if (this.status !== 'day') return;

        const count = {};
        for (const [, target] of Object.entries(this.votes)) {
            if (target === 'none') continue;
            count[target] = (count[target] || 0) + 1;
        }

        const sorted     = Object.entries(count).sort((a, b) => b[1] - a[1]);
        const topEntry   = sorted[0];
        const totalVotes = Object.keys(this.votes).length;
        const eliminated = (topEntry && topEntry[1] > totalVotes / 2) ? topEntry[0] : null;

        if (eliminated) {
            const em   = await this.channel.guild.members.fetch(eliminated).catch(() => null);
            const role = this.roles[eliminated];
            const rd   = MAFIA_ROLES[role];

            // فوز المهرج الفوري
            if (role === 'مهرج') {
                this.alive = this.alive.filter(id => id !== eliminated);
                await this.announceWin('مهرج', em?.user.username);
                return;
            }

            this.alive = this.alive.filter(id => id !== eliminated);
            await this.channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('⚖️ تم الإعدام')
                    .setDescription(`قرّر الشعب إعدام **${em?.user.username || 'لاعب'}**.\nكان دوره: ${rd.emoji} **${role}**`)
                    .setThumbnail(rd.image)
                    .setColor(0xE67E22)
                ]
            });
        } else {
            const voteLines = sorted.slice(0, 5)
                .map(([uid, n]) => `${this.channel.guild.members.cache.get(uid)?.user.username || '؟'}: **${n} أصوات**`)
                .join('\n') || 'لا أصوات';
            await this.channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('⚖️ لا أغلبية — لا إعدام')
                    .setDescription(`لم تصل الأصوات للأغلبية.\n\n${voteLines}`)
                    .setColor(0x95A5A6)
                ]
            });
        }

        const winner = this.checkWin();
        if (winner) { await this.announceWin(winner); return; }
        this.status = 'night';
        setTimeout(() => this.startNight(), 4000);
    }

    // ===== فحص شرط الفوز =====
    checkWin() {
        const mafiaAlive    = this.alive.filter(id => this.roles[id] === 'مافيا').length;
        const nonMafiaAlive = this.alive.filter(id => this.roles[id] !== 'مافيا' && this.roles[id] !== 'مهرج').length;
        if (mafiaAlive === 0)             return 'مدنيون';
        if (mafiaAlive >= nonMafiaAlive)  return 'مافيا';
        return null;
    }

    // ===== إعلان الفوز مع صورة مولّدة =====
    async announceWin(winnerType, jesterName) {
        const cfgs = {
            'مدنيون': { title: '🎉 فاز المدنيون!',  desc: 'تم القضاء على كل المافيا!\n**البلدة آمنة الآن.**',         color: 0x27AE60 },
            'مافيا':  { title: '💀 فازت المافيا!',  desc: 'المافيا سيطرت على البلدة!\n**لا أمل للمدنيين...**',       color: 0xC0392B },
            'مهرج':  { title: '🃏 فاز المهرج!',    desc: `**${jesterName || 'المهرج'}** خدعكم جميعاً!\nأُعدم بإرادته وفاز!`, color: 0xF39C12 }
        };
        const cfg = cfgs[winnerType];

        // توليد صورة النتيجة
        let imgBuf = null;
        try {
            imgBuf = await generateWinImage([...this.players], this.roles, this.channel.guild, winnerType);
        } catch (e) {
            console.error('[Mafia] win image error:', e.message);
        }

        const embed = new EmbedBuilder()
            .setTitle(cfg.title)
            .setDescription(cfg.desc)
            .setColor(cfg.color);

        if (imgBuf) {
            const attachment = new AttachmentBuilder(imgBuf, { name: 'mafia_result.png' });
            embed.setImage('attachment://mafia_result.png');
            await this.channel.send({ embeds: [embed], files: [attachment] });
        } else {
            await this.channel.send({ embeds: [embed] });
        }

        this.endGame();
    }

    endGame() {
        this.status = 'ended';
        clearInterval(this.interval);
        this.timers.forEach(t => clearTimeout(t));
        delete mafiaGames[this.guildId];
    }

    // ===== معالجة التفاعلات =====
    async handleInteraction(interaction) {
        const id  = interaction.customId;
        const uid = interaction.user.id;

        // انضمام
        if (id === 'mafia_join') {
            if (this.status !== 'waiting') return interaction.reply({ content: '❌ اللعبة بدأت.', flags: 64 });
            if (this.players.includes(uid)) return interaction.reply({ content: '❌ أنت منضم بالفعل.', flags: 64 });
            if (this.players.length >= config.mafia.maxPlayers) return interaction.reply({ content: '❌ اللعبة ممتلئة.', flags: 64 });
            this.players.push(uid);
            await interaction.reply({ content: '✅ انضممت للعبة!', flags: 64 });
            this.updatePanel();
        }

        // مغادرة
        else if (id === 'mafia_leave') {
            if (this.status !== 'waiting') return interaction.reply({ content: '❌ لا يمكنك المغادرة بعد البدء.', flags: 64 });
            if (!this.players.includes(uid)) return interaction.reply({ content: '❌ أنت لست منضماً.', flags: 64 });
            this.players = this.players.filter(i => i !== uid);
            await interaction.reply({ content: '✅ غادرت اللعبة.', flags: 64 });
            this.updatePanel();
        }

        // كشف الدور — ephemeral في القناة
        else if (id === 'mafia_reveal_role') {
            if (!this.players.includes(uid))
                return interaction.reply({ content: '❌ أنت لست من لاعبي هذه اللعبة.', flags: 64 });
            if (this.status === 'waiting')
                return interaction.reply({ content: '⏳ اللعبة لم تبدأ بعد، انتظر توزيع الأدوار.', flags: 64 });

            const role = this.roles[uid];
            if (!role)
                return interaction.reply({ content: '❌ لم يتم تعيين دورك بعد.', flags: 64 });

            const rd = MAFIA_ROLES[role];
            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🎭 دورك في اللعبة')
                    .setDescription(rd.description)
                    .setImage(rd.image)
                    .setColor(rd.color)
                    .setFooter({ text: 'هذه الرسالة مرئية لك فقط — لا تكشف دورك!' })
                ],
                flags: 64
            });
        }

        // المافيا تختار ضحية
        else if (id.startsWith('mafia_kill_')) {
            if (this.status !== 'night') return interaction.reply({ content: '❌ ليس وقت الليل.', flags: 64 });
            if (this.roles[uid] !== 'مافيا') return interaction.reply({ content: '❌ أنت لست مافيا.', flags: 64 });
            const tId = id.replace('mafia_kill_', '');
            if (!this.alive.includes(tId)) return interaction.reply({ content: '❌ اللاعب ليس حياً.', flags: 64 });
            this.nightKill = tId;
            await interaction.reply({ content: `✅ اخترت قتل <@${tId}> هذه الليلة.`, flags: 64 });
        }

        // الطبيب يختار من ينقذ
        else if (id.startsWith('doctor_save_')) {
            if (this.status !== 'night') return interaction.reply({ content: '❌ ليس وقت الليل.', flags: 64 });
            if (this.roles[uid] !== 'طبيب') return interaction.reply({ content: '❌ أنت لست طبيباً.', flags: 64 });
            if (id === 'doctor_save_none') {
                this.doctorSave = null;
                await interaction.reply({ content: '✅ لن تنقذ أحداً الليلة.', flags: 64 });
            } else {
                const tId = id.replace('doctor_save_', '');
                if (!this.alive.includes(tId)) return interaction.reply({ content: '❌ اللاعب ليس حياً.', flags: 64 });
                this.doctorSave = tId;
                await interaction.reply({ content: `✅ ستحمي <@${tId}> الليلة.`, flags: 64 });
            }
        }

        // التصويت النهاري
        else if (id.startsWith('vote_')) {
            if (this.status !== 'day') return interaction.reply({ content: '❌ ليس وقت التصويت.', flags: 64 });
            if (!this.alive.includes(uid)) return interaction.reply({ content: '❌ أنت ميت، لا يمكنك التصويت.', flags: 64 });
            const target = id.replace('vote_', '');
            const prev   = this.votes[uid];
            this.votes[uid] = target;

            const getName = i => this.channel.guild.members.cache.get(i)?.user.username || '؟';
            const prevNote = prev && prev !== target
                ? `\n_(تم تغيير صوتك من **${prev === 'none' ? 'امتناع' : getName(prev)}**)_`
                : '';

            await interaction.reply({
                content: target === 'none'
                    ? `✅ امتنعت عن التصويت.${prevNote}`
                    : `✅ صوتك مسجل ضد **${getName(target)}**.${prevNote}`,
                flags: 64
            });
        }
    }
}

// ========== بناء وإرسال لوحة التذاكر ==========
async function sendTicketPanel(channel, guildId) {
    const cfg   = db.guildConfig?.[guildId] || {};
    const types = (cfg.ticketTypes?.length > 0) ? cfg.ticketTypes : config.tickets.types;

    const embed = new EmbedBuilder()
        .setTitle(cfg.panelTitle || '📩 نظام التذاكر')
        .setDescription(cfg.panelDescription || 'اختر نوع التذكرة التي تريد فتحها:')
        .setColor('Blue')
        .setFooter({ text: 'سيتم إنشاء قناة خاصة بك' });

    if (cfg.panelType === 'select') {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder('اختر نوع التذكرة...')
            .setMinValues(1).setMaxValues(1);
        types.forEach(t => {
            const opt = new StringSelectMenuOptionBuilder().setLabel(t.name).setValue(t.id);
            const em = parseEmoji(t.emoji);
            if (em) opt.setEmoji(em);
            menu.addOptions(opt);
        });
        await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    } else {
        const rows = [];
        for (let i = 0; i < Math.min(types.length, 25); i++) {
            const t   = types[i];
            const btn = new ButtonBuilder().setCustomId(`ticket_${t.id}`).setLabel(t.name).setStyle(ButtonStyle.Primary);
            const em  = parseEmoji(t.emoji);
            if (em) btn.setEmoji(em);
            const ri = Math.floor(i / 5);
            if (!rows[ri]) rows[ri] = new ActionRowBuilder();
            rows[ri].addComponents(btn);
        }
        await channel.send({ embeds: [embed], components: rows });
    }
}

// ========== أوامر السلاش — التعريف ==========
function buildCommands() {
    return [
        // ===== نظام التذاكر =====
        new SlashCommandBuilder()
            .setName('إعداد-تذاكر')
            .setDescription('إعداد نظام التذاكر بالكامل')
            .addChannelOption(o => o.setName('قناة_اللوحة').setDescription('قناة لوحة التذاكر').setRequired(true))
            .addRoleOption(o => o.setName('رتبة_استلام_1').setDescription('رتبة المشرفين الأساسية').setRequired(true))
            .addRoleOption(o => o.setName('رتبة_استلام_2').setDescription('رتبة مشرفين ثانية').setRequired(false))
            .addRoleOption(o => o.setName('ذكر_1').setDescription('رتبة تُذكر عند فتح التذكرة').setRequired(false))
            .addRoleOption(o => o.setName('ذكر_2').setDescription('رتبة ثانية تُذكر عند الفتح').setRequired(false))
            .addStringOption(o => o.setName('عنوان_اللوحة').setDescription('عنوان embed اللوحة').setRequired(false))
            .addStringOption(o => o.setName('وصف_اللوحة').setDescription('وصف embed اللوحة').setRequired(false))
            .addStringOption(o => o.setName('اسم_التذكرة').setDescription('نمط الاسم: {رقم} {user} {نوع}').setRequired(false))
            .addChannelOption(o => o.setName('فئة_التذاكر').setDescription('فئة قنوات التذاكر').setRequired(false))
            .addStringOption(o => o.setName('نوع_العرض').setDescription('طريقة العرض').setRequired(false)
                .addChoices({ name: '🔘 أزرار', value: 'buttons' }, { name: '📋 قائمة منسدلة', value: 'select' })),

        new SlashCommandBuilder()
            .setName('إعداد-لوق')
            .setDescription('تعيين قناة لوق التذاكر والموديريشن')
            .addChannelOption(o => o.setName('القناة').setDescription('قناة اللوق').setRequired(true)),

        new SlashCommandBuilder()
            .setName('إضافة-نوع-تذكرة')
            .setDescription('إضافة نوع تذكرة للوحة')
            .addStringOption(o => o.setName('الاسم').setDescription('اسم النوع').setRequired(true))
            .addStringOption(o => o.setName('الايموجي').setDescription('إيموجي عادي أو مخصص <:name:id>').setRequired(false)),

        new SlashCommandBuilder()
            .setName('حذف-نوع-تذكرة')
            .setDescription('حذف نوع تذكرة')
            .addStringOption(o => o.setName('الاسم').setDescription('اسم النوع').setRequired(true)),

        new SlashCommandBuilder()
            .setName('أنواع-التذاكر')
            .setDescription('عرض أنواع التذاكر الحالية'),

        new SlashCommandBuilder()
            .setName('إضافة-عضو')
            .setDescription('إضافة عضو لقناة التذكرة الحالية')
            .addUserOption(o => o.setName('العضو').setDescription('العضو المراد إضافته').setRequired(true)),

        new SlashCommandBuilder()
            .setName('إزالة-عضو')
            .setDescription('إزالة عضو من قناة التذكرة الحالية')
            .addUserOption(o => o.setName('العضو').setDescription('العضو المراد إزالته').setRequired(true)),

        // ===== نظام الترحيب =====
        new SlashCommandBuilder()
            .setName('إعداد-ترحيب')
            .setDescription('إعداد رسالة الترحيب بالأعضاء الجدد')
            .addChannelOption(o => o.setName('القناة').setDescription('قناة الترحيب').setRequired(true))
            .addStringOption(o => o.setName('الرسالة').setDescription('نص الترحيب — {user} للذكر، {server} للسيرفر').setRequired(false))
            .addRoleOption(o => o.setName('الرتبة_التلقائية').setDescription('رتبة تُعطى للأعضاء عند الانضمام').setRequired(false)),

        new SlashCommandBuilder()
            .setName('إعداد-وداع')
            .setDescription('إعداد رسالة وداع الأعضاء')
            .addChannelOption(o => o.setName('القناة').setDescription('قناة الوداع').setRequired(true))
            .addStringOption(o => o.setName('الرسالة').setDescription('نص الوداع — {user} {server}').setRequired(false)),

        // ===== نظام المافيا =====
        new SlashCommandBuilder()
            .setName('إعداد-مافيا')
            .setDescription('تعيين قناة ألعاب المافيا')
            .addChannelOption(o => o.setName('القناة').setDescription('قناة المافيا').setRequired(true)),

        // ===== نظام التحذيرات =====
        new SlashCommandBuilder()
            .setName('تحذير')
            .setDescription('تحذير عضو')
            .addUserOption(o => o.setName('العضو').setDescription('العضو').setRequired(true))
            .addStringOption(o => o.setName('السبب').setDescription('سبب التحذير').setRequired(true)),

        new SlashCommandBuilder()
            .setName('تحذيرات')
            .setDescription('عرض تحذيرات عضو')
            .addUserOption(o => o.setName('العضو').setDescription('العضو').setRequired(true)),

        new SlashCommandBuilder()
            .setName('حذف-تحذير')
            .setDescription('حذف تحذير محدد')
            .addUserOption(o => o.setName('العضو').setDescription('العضو').setRequired(true))
            .addIntegerOption(o => o.setName('الرقم').setDescription('رقم التحذير من القائمة').setRequired(true).setMinValue(1)),

        new SlashCommandBuilder()
            .setName('مسح-تحذيرات')
            .setDescription('مسح كل تحذيرات عضو')
            .addUserOption(o => o.setName('العضو').setDescription('العضو').setRequired(true)),

        // ===== الموديريشن =====
        new SlashCommandBuilder()
            .setName('طرد')
            .setDescription('طرد عضو من السيرفر')
            .addUserOption(o => o.setName('العضو').setDescription('العضو').setRequired(true))
            .addStringOption(o => o.setName('السبب').setDescription('السبب').setRequired(false)),

        new SlashCommandBuilder()
            .setName('حظر')
            .setDescription('حظر عضو من السيرفر')
            .addUserOption(o => o.setName('العضو').setDescription('العضو').setRequired(true))
            .addStringOption(o => o.setName('السبب').setDescription('السبب').setRequired(false)),

        new SlashCommandBuilder()
            .setName('فك-حظر')
            .setDescription('فك حظر عضو')
            .addStringOption(o => o.setName('معرف_العضو').setDescription('ID العضو المحظور').setRequired(true)),

        new SlashCommandBuilder()
            .setName('كتم')
            .setDescription('كتم عضو (Timeout)')
            .addUserOption(o => o.setName('العضو').setDescription('العضو').setRequired(true))
            .addIntegerOption(o => o.setName('المدة').setDescription('المدة بالدقائق (1-40320)').setRequired(true).setMinValue(1).setMaxValue(40320))
            .addStringOption(o => o.setName('السبب').setDescription('السبب').setRequired(false)),

        new SlashCommandBuilder()
            .setName('فك-كتم')
            .setDescription('فك كتم عضو')
            .addUserOption(o => o.setName('العضو').setDescription('العضو').setRequired(true)),

        new SlashCommandBuilder()
            .setName('مسح-رسائل')
            .setDescription('مسح عدد من الرسائل')
            .addIntegerOption(o => o.setName('العدد').setDescription('عدد الرسائل (2-100)').setRequired(true).setMinValue(2).setMaxValue(100)),

        // ===== أوامر المعلومات =====
        new SlashCommandBuilder()
            .setName('معلومات-العضو')
            .setDescription('عرض معلومات عضو')
            .addUserOption(o => o.setName('العضو').setDescription('العضو (اتركه فارغاً لمعلوماتك)').setRequired(false)),

        new SlashCommandBuilder()
            .setName('معلومات-السيرفر')
            .setDescription('عرض معلومات السيرفر'),

        new SlashCommandBuilder()
            .setName('معلومات-البوت')
            .setDescription('عرض معلومات وإحصائيات البوت'),

        // ===== الإعلانات =====
        new SlashCommandBuilder()
            .setName('إعلان')
            .setDescription('إرسال إعلان منسق')
            .addChannelOption(o => o.setName('القناة').setDescription('قناة الإعلان').setRequired(true))
            .addStringOption(o => o.setName('العنوان').setDescription('عنوان الإعلان').setRequired(true))
            .addStringOption(o => o.setName('الرسالة').setDescription('محتوى الإعلان').setRequired(true))
            .addStringOption(o => o.setName('اللون').setDescription('لون الـ embed (مثال: Red, Blue, #ff0000)').setRequired(false))
            .addStringOption(o => o.setName('ذكر').setDescription('@everyone أو @here أو رتبة').setRequired(false)),

        // ===== PetPet (سلاش) =====
        new SlashCommandBuilder()
            .setName('petpet')
            .setDescription('اصنع GIF petpet واقعي لعضو')
            .addUserOption(o => o.setName('العضو').setDescription('العضو المراد عمل petpet له').setRequired(true)),

        // ===== نظام التفاعلات التلقائية =====
        new SlashCommandBuilder()
            .setName('إعداد-تفاعل')
            .setDescription('ضبط تفاعل تلقائي على رسائل قناة معينة')
            .addChannelOption(o => o.setName('القناة').setDescription('القناة المستهدفة').setRequired(true))
            .addStringOption(o => o.setName('الايموجي').setDescription('إيموجي يونيكود أو من السيرفر مثل <:name:id> أو <a:name:id>').setRequired(true)),

        new SlashCommandBuilder()
            .setName('حذف-تفاعل')
            .setDescription('حذف التفاعل التلقائي من قناة')
            .addChannelOption(o => o.setName('القناة').setDescription('القناة').setRequired(true)),

        new SlashCommandBuilder()
            .setName('تفاعلات')
            .setDescription('عرض جميع التفاعلات التلقائية المضبوطة'),

        // ===== قائمة الأوامر =====
        new SlashCommandBuilder()
            .setName('مساعدة')
            .setDescription('عرض قائمة جميع أوامر البوت'),
    ].map(cmd => cmd.toJSON());
}

// ========== حدث الجاهزية ==========
client.once('ready', async () => {
    console.log(`✅ تم تسجيل الدخول بنجاح: ${client.user.tag}`);

    // تحميل إطارات اليد مسبقاً
    try {
        await loadHandFrames();
        console.log('✅ تم تحميل إطارات PetPet');
    } catch (e) {
        console.error('⚠️ فشل تحميل إطارات PetPet:', e.message);
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: buildCommands() });
        console.log('✅ تم تسجيل جميع أوامر السلاش');
    } catch (e) {
        console.error('❌ فشل تسجيل الأوامر:', e.message);
    }
});

// ===== حدث انضمام عضو جديد =====
client.on('guildMemberAdd', async member => {
    const cfg = db.guildConfig?.[member.guild.id];
    if (!cfg) return;

    if (cfg.welcomeChannelId) {
        const ch = member.guild.channels.cache.get(cfg.welcomeChannelId);
        if (ch) {
            const msg = (cfg.welcomeMessage || 'مرحباً {user} في سيرفر **{server}**! 🎉')
                .replace('{user}', `${member}`)
                .replace('{server}', member.guild.name);
            await ch.send({
                embeds: [new EmbedBuilder()
                    .setTitle('👋 مرحباً بالعضو الجديد!')
                    .setDescription(msg)
                    .setThumbnail(member.user.displayAvatarURL())
                    .setColor('Green')
                    .addFields(
                        { name: '📛 الاسم',   value: member.user.tag,                                   inline: true },
                        { name: '👥 العدد',   value: `${member.guild.memberCount} عضو`,                 inline: true },
                        { name: '📅 الحساب', value: `<t:${Math.floor(member.user.createdTimestamp/1000)}:R>`, inline: true }
                    )
                    .setTimestamp()
                ]
            }).catch(() => {});
        }
    }

    if (cfg.autoRoleId) {
        const role = member.guild.roles.cache.get(cfg.autoRoleId);
        if (role) member.roles.add(role).catch(() => {});
    }
});

// ===== حدث مغادرة عضو =====
client.on('guildMemberRemove', async member => {
    const cfg = db.guildConfig?.[member.guild.id];
    if (!cfg?.leaveChannelId) return;
    const ch = member.guild.channels.cache.get(cfg.leaveChannelId);
    if (!ch) return;
    const msg = (cfg.leaveMessage || 'وداعاً {user}، غادر سيرفر **{server}**.')
        .replace('{user}', member.user.tag)
        .replace('{server}', member.guild.name);
    await ch.send({
        embeds: [new EmbedBuilder()
            .setTitle('👋 مغادرة عضو')
            .setDescription(msg)
            .setThumbnail(member.user.displayAvatarURL())
            .setColor('Red')
            .setTimestamp()
        ]
    }).catch(() => {});
});

// ===== معالج الرسائل =====
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // ===== التفاعل التلقائي =====
    await handleAutoReact(message);

    // ===== مشغّلات الكلمات المفتاحية =====
    const msgText = message.content;

    if (msgText.includes('الضريح الخبيث')) {
        const gifBuf = await getShrineGif();
        if (gifBuf) {
            await message.channel.send({ files: [new AttachmentBuilder(gifBuf, { name: 'shrine.gif' })] });
        } else {
            await message.channel.send('https://cdn.discordapp.com/attachments/1480646829019238493/1481425266365432019/image0.gif');
        }
        return;
    }

    if (msgText.includes('الفراغ اللانهائي')) {
        await message.channel.send('https://tenor.com/view/satoru-gojo-domain-expansion-muryoo-kuusho-six-eyes-jujutsu-kaisen-gif-2102848127558680877');
        return;
    }

    if (!message.content.startsWith(config.prefix)) return;

    const args    = message.content.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const guildId = message.guild.id;
    const cfg     = db.guildConfig?.[guildId] || {};

    if (command === 'مافيا') {
        if (cfg.mafiaChannelId && message.channel.id !== cfg.mafiaChannelId)
            return message.reply('❌ استخدم هذا الأمر في قناة المافيا المحددة.');
        if (mafiaGames[guildId])
            return message.reply('❌ هناك لعبة جارية بالفعل في هذا السيرفر.');
        const game = new MafiaGame(guildId, message.channel);
        mafiaGames[guildId] = game;
        game.startWaiting();
    }

    else if (command === 'petpet') {
        let targetUser = message.mentions.users.first();

        if (!targetUser && message.reference?.messageId) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                targetUser = repliedMsg.author;
            } catch { targetUser = null; }
        }

        if (!targetUser) {
            return message.reply('❌ يرجى منشنة شخص أو الرد على رسالته لاستخدام أمر `!petpet`.');
        }

        if (targetUser.bot && targetUser.id === client.user.id) {
            targetUser = message.author;
        }

        try {
            await message.channel.sendTyping();
            const gifBuffer = await createPetpetGif(targetUser);
            if (!gifBuffer) {
                return message.reply('❌ تعذّر تحميل صورة المستخدم، حاول مجدداً.');
            }
            const attachment = new AttachmentBuilder(gifBuffer, { name: 'petpet.gif' });
            await message.reply({ files: [attachment] });
        } catch (err) {
            console.error('خطأ في petpet:', err);
            message.reply('❌ حدث خطأ أثناء إنشاء الصورة.').catch(() => {});
        }
    }
});

// ========== معالج التفاعلات ==========
client.on('interactionCreate', async interaction => {

    // ===== أوامر السلاش =====
    if (interaction.isChatInputCommand()) {
        const guildId  = interaction.guild.id;
        const member   = interaction.member;
        const isAdmin  = member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isMod    = isAdmin || member.permissions.has(PermissionsBitField.Flags.ModerateMembers);
        const cmd      = interaction.commandName;

        // ===================================
        // ===== إعداد التذاكر =====
        // ===================================
        if (cmd === 'إعداد-تذاكر') {
            if (!isAdmin) return interaction.reply({ embeds: [errEmbed('هذا الأمر للمشرفين فقط.')], flags: 64 });

            const panelCh  = interaction.options.getChannel('قناة_اللوحة');
            const role1    = interaction.options.getRole('رتبة_استلام_1');
            const role2    = interaction.options.getRole('رتبة_استلام_2');
            const men1     = interaction.options.getRole('ذكر_1');
            const men2     = interaction.options.getRole('ذكر_2');
            const title    = interaction.options.getString('عنوان_اللوحة');
            const desc     = interaction.options.getString('وصف_اللوحة');
            const template = interaction.options.getString('اسم_التذكرة');
            const category = interaction.options.getChannel('فئة_التذاكر');
            const display  = interaction.options.getString('نوع_العرض');

            if (panelCh.type !== ChannelType.GuildText)
                return interaction.reply({ embeds: [errEmbed('يجب اختيار قناة نصية.')], flags: 64 });

            if (!db.guildConfig[guildId]) db.guildConfig[guildId] = {};
            const c = db.guildConfig[guildId];
            c.ticketChannelId = panelCh.id;
            c.staffRole1 = role1.id;
            if (role2)    c.staffRole2          = role2.id;
            if (men1)     c.mention1             = men1.id;
            if (men2)     c.mention2             = men2.id;
            if (title)    c.panelTitle           = title;
            if (desc)     c.panelDescription     = desc;
            if (template) c.ticketNameTemplate   = template;
            if (category) c.ticketCategoryId     = category.id;
            if (display)  c.panelType            = display;
            saveDB();

            await sendTicketPanel(panelCh, guildId);
            await interaction.reply({
                embeds: [new EmbedBuilder().setTitle('✅ تم إعداد نظام التذاكر').setColor('Green')
                    .addFields(
                        { name: '📢 قناة اللوحة',    value: `${panelCh}`,                                      inline: true },
                        { name: '🛡️ رتبة الاستلام',   value: `${role1}`,                                        inline: true },
                        { name: '🔢 رتبة ثانية',      value: role2 ? `${role2}` : 'لا يوجد',                   inline: true },
                        { name: '📣 ذكر 1',           value: men1 ? `${men1}` : 'لا يوجد',                     inline: true },
                        { name: '📣 ذكر 2',           value: men2 ? `${men2}` : 'لا يوجد',                     inline: true },
                        { name: '📝 نمط الاسم',       value: template || 'تذكرة-{رقم}',                         inline: true },
                        { name: '📁 الفئة',           value: category ? `${category.name}` : 'بدون فئة',       inline: true },
                        { name: '🖥️ نوع العرض',       value: display === 'select' ? '📋 قائمة منسدلة' : '🔘 أزرار', inline: true },
                    )
                ],
                flags: 64
            });
        }

        else if (cmd === 'إعداد-لوق') {
            if (!isAdmin) return interaction.reply({ embeds: [errEmbed('هذا الأمر للمشرفين فقط.')], flags: 64 });
            const ch = interaction.options.getChannel('القناة');
            if (!db.guildConfig[guildId]) db.guildConfig[guildId] = {};
            db.guildConfig[guildId].logChannelId = ch.id;
            saveDB();
            await interaction.reply({ embeds: [okEmbed(`تم تعيين ${ch} كقناة لوق للتذاكر والموديريشن.`)], flags: 64 });
        }

        else if (cmd === 'إضافة-نوع-تذكرة') {
            if (!isAdmin) return interaction.reply({ embeds: [errEmbed('هذا الأمر للمشرفين فقط.')], flags: 64 });
            const name  = interaction.options.getString('الاسم');
            const emoji = interaction.options.getString('الايموجي') || '';
            if (!db.guildConfig[guildId]) db.guildConfig[guildId] = {};
            if (!db.guildConfig[guildId].ticketTypes) db.guildConfig[guildId].ticketTypes = [];
            if (db.guildConfig[guildId].ticketTypes.some(t => t.name === name))
                return interaction.reply({ embeds: [errEmbed(`يوجد نوع باسم **${name}** بالفعل.`)], flags: 64 });
            if (db.guildConfig[guildId].ticketTypes.length >= 25)
                return interaction.reply({ embeds: [errEmbed('الحد الأقصى هو 25 نوع.')], flags: 64 });
            const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9أ-ي\-]/g, '').slice(0, 20) || `t${Date.now()}`;
            db.guildConfig[guildId].ticketTypes.push({ id, name, emoji });
            saveDB();
            await interaction.reply({ content: `✅ تم إضافة نوع **${name}** ${emoji}\n💡 أعد إرسال اللوحة عبر \`/إعداد-تذاكر\` لتطبيق التغيير.`, flags: 64 });
        }

        else if (cmd === 'حذف-نوع-تذكرة') {
            if (!isAdmin) return interaction.reply({ embeds: [errEmbed('هذا الأمر للمشرفين فقط.')], flags: 64 });
            const name  = interaction.options.getString('الاسم');
            const types = db.guildConfig[guildId]?.ticketTypes || [];
            const idx   = types.findIndex(t => t.name === name);
            if (idx === -1) return interaction.reply({ embeds: [errEmbed(`لا يوجد نوع باسم **${name}**.`)], flags: 64 });
            db.guildConfig[guildId].ticketTypes.splice(idx, 1);
            saveDB();
            await interaction.reply({ content: `✅ تم حذف نوع **${name}**.\n💡 أعد إرسال اللوحة لتطبيق التغيير.`, flags: 64 });
        }

        else if (cmd === 'أنواع-التذاكر') {
            const types = db.guildConfig[guildId]?.ticketTypes;
            const display = db.guildConfig[guildId]?.panelType || 'buttons';
            if (!types?.length) {
                const def = config.tickets.types.map((t, i) => `\`${i+1}.\` ${t.emoji} **${t.name}**`).join('\n');
                return interaction.reply({ content: `📋 **الأنواع الافتراضية:**\n${def}`, flags: 64 });
            }
            const list = types.map((t, i) => `\`${i+1}.\` ${t.emoji || ''} **${t.name}**`).join('\n');
            await interaction.reply({
                content: `📋 **الأنواع المضافة (${types.length}):**\n${list}\n\n🖥️ **نوع العرض:** ${display === 'select' ? '📋 قائمة منسدلة' : '🔘 أزرار'}`,
                flags: 64
            });
        }

        else if (cmd === 'إضافة-عضو') {
            const cfg2 = db.guildConfig?.[guildId] || {};
            const staffRoleIds = [cfg2.staffRole1, cfg2.staffRole2].filter(Boolean);
            const isStaff = isAdmin || staffRoleIds.some(r => member.roles.cache.has(r));
            if (!isStaff) return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية.')], flags: 64 });

            const target = interaction.options.getMember('العضو');
            await interaction.channel.permissionOverwrites.edit(target.id, {
                ViewChannel: true, SendMessages: true, ReadMessageHistory: true
            });
            await interaction.reply({ embeds: [okEmbed(`تم إضافة ${target} لهذه القناة.`)], flags: 64 });
        }

        else if (cmd === 'إزالة-عضو') {
            const cfg2 = db.guildConfig?.[guildId] || {};
            const staffRoleIds = [cfg2.staffRole1, cfg2.staffRole2].filter(Boolean);
            const isStaff = isAdmin || staffRoleIds.some(r => member.roles.cache.has(r));
            if (!isStaff) return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية.')], flags: 64 });

            const target = interaction.options.getMember('العضو');
            await interaction.channel.permissionOverwrites.edit(target.id, { ViewChannel: false });
            await interaction.reply({ embeds: [okEmbed(`تم إزالة ${target} من هذه القناة.`)], flags: 64 });
        }

        // ===================================
        // ===== إعداد الترحيب والوداع =====
        // ===================================
        else if (cmd === 'إعداد-ترحيب') {
            if (!isAdmin) return interaction.reply({ embeds: [errEmbed('هذا الأمر للمشرفين فقط.')], flags: 64 });
            const ch   = interaction.options.getChannel('القناة');
            const msg  = interaction.options.getString('الرسالة');
            const role = interaction.options.getRole('الرتبة_التلقائية');
            if (!db.guildConfig[guildId]) db.guildConfig[guildId] = {};
            db.guildConfig[guildId].welcomeChannelId = ch.id;
            if (msg)  db.guildConfig[guildId].welcomeMessage = msg;
            if (role) db.guildConfig[guildId].autoRoleId = role.id;
            saveDB();
            await interaction.reply({
                embeds: [new EmbedBuilder().setColor('Green').setTitle('✅ تم إعداد الترحيب')
                    .addFields(
                        { name: '📢 قناة الترحيب',    value: `${ch}`,                    inline: true },
                        { name: '🎭 الرتبة التلقائية', value: role ? `${role}` : 'بدون', inline: true },
                        { name: '💬 الرسالة',         value: msg || 'الافتراضية',         inline: true }
                    )
                ],
                flags: 64
            });
        }

        else if (cmd === 'إعداد-وداع') {
            if (!isAdmin) return interaction.reply({ embeds: [errEmbed('هذا الأمر للمشرفين فقط.')], flags: 64 });
            const ch  = interaction.options.getChannel('القناة');
            const msg = interaction.options.getString('الرسالة');
            if (!db.guildConfig[guildId]) db.guildConfig[guildId] = {};
            db.guildConfig[guildId].leaveChannelId = ch.id;
            if (msg) db.guildConfig[guildId].leaveMessage = msg;
            saveDB();
            await interaction.reply({ embeds: [okEmbed(`تم تعيين ${ch} كقناة وداع.`)], flags: 64 });
        }

        // ===================================
        // ===== إعداد المافيا =====
        // ===================================
        else if (cmd === 'إعداد-مافيا') {
            if (!isAdmin) return interaction.reply({ embeds: [errEmbed('هذا الأمر للمشرفين فقط.')], flags: 64 });
            const ch = interaction.options.getChannel('القناة');
            if (ch.type !== ChannelType.GuildText)
                return interaction.reply({ embeds: [errEmbed('يجب اختيار قناة نصية.')], flags: 64 });
            if (!db.guildConfig[guildId]) db.guildConfig[guildId] = {};
            db.guildConfig[guildId].mafiaChannelId = ch.id;
            saveDB();
            await ch.send({ embeds: [new EmbedBuilder().setTitle('🎲 قناة ألعاب المافيا').setDescription(`اكتب \`!مافيا\` هنا لبدء لعبة جديدة.`).setColor('Purple')] });
            await interaction.reply({ embeds: [okEmbed(`تم تعيين ${ch} كقناة للمافيا.`)], flags: 64 });
        }

        // ===================================
        // ===== نظام التحذيرات =====
        // ===================================
        else if (cmd === 'تحذير') {
            if (!isMod) return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية.')], flags: 64 });
            const target = interaction.options.getUser('العضو');
            const reason = interaction.options.getString('السبب');
            if (!db.warnings[guildId]) db.warnings[guildId] = {};
            if (!db.warnings[guildId][target.id]) db.warnings[guildId][target.id] = [];
            const wId = db.warnings[guildId][target.id].length + 1;
            db.warnings[guildId][target.id].push({ id: wId, reason, staffId: interaction.user.id, date: new Date().toISOString() });
            saveDB();

            const targetMember = interaction.guild.members.cache.get(target.id);
            if (targetMember) {
                targetMember.send({ embeds: [new EmbedBuilder().setTitle('⚠️ تلقيت تحذيراً').setColor('Yellow')
                    .addFields({ name: 'السبب', value: reason }, { name: 'السيرفر', value: interaction.guild.name })
                ]}).catch(() => {});
            }

            const total = db.warnings[guildId][target.id].length;
            const embed = new EmbedBuilder().setTitle('⚠️ تم إصدار تحذير').setColor('Yellow')
                .addFields(
                    { name: '👤 العضو',            value: `${target.tag}`,            inline: true },
                    { name: '📝 السبب',            value: reason,                     inline: true },
                    { name: '🔢 إجمالي التحذيرات', value: `${total}`,                 inline: true },
                    { name: '🛡️ أصدره',             value: `${interaction.user.tag}`, inline: true }
                );
            await interaction.reply({ embeds: [embed] });
            await sendLog(interaction.guild, embed);
        }

        else if (cmd === 'تحذيرات') {
            const target = interaction.options.getUser('العضو');
            const warns  = db.warnings?.[guildId]?.[target.id];
            if (!warns?.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Blue').setDescription(`📋 لا توجد تحذيرات لـ **${target.tag}**.`)], flags: 64 });

            const list = warns.map(w => `\`#${w.id}\` **${w.reason}** — بواسطة <@${w.staffId}> <t:${Math.floor(new Date(w.date).getTime()/1000)}:R>`).join('\n');
            await interaction.reply({
                embeds: [new EmbedBuilder().setTitle(`⚠️ تحذيرات ${target.tag}`).setColor('Yellow').setDescription(list).setFooter({ text: `الإجمالي: ${warns.length}` })],
                flags: 64
            });
        }

        else if (cmd === 'حذف-تحذير') {
            if (!isMod) return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية.')], flags: 64 });
            const target = interaction.options.getUser('العضو');
            const num    = interaction.options.getInteger('الرقم');
            const warns  = db.warnings?.[guildId]?.[target.id];
            if (!warns?.length) return interaction.reply({ embeds: [errEmbed('لا توجد تحذيرات لهذا العضو.')], flags: 64 });
            const idx = warns.findIndex(w => w.id === num);
            if (idx === -1) return interaction.reply({ embeds: [errEmbed(`لا يوجد تحذير رقم ${num}.`)], flags: 64 });
            warns.splice(idx, 1);
            saveDB();
            await interaction.reply({ embeds: [okEmbed(`تم حذف التحذير رقم ${num} من سجل **${target.tag}**.`)], flags: 64 });
        }

        else if (cmd === 'مسح-تحذيرات') {
            if (!isMod) return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية.')], flags: 64 });
            const target = interaction.options.getUser('العضو');
            if (db.warnings[guildId]) db.warnings[guildId][target.id] = [];
            saveDB();
            await interaction.reply({ embeds: [okEmbed(`تم مسح جميع تحذيرات **${target.tag}**.`)], flags: 64 });
        }

        // ===================================
        // ===== الموديريشن =====
        // ===================================
        else if (cmd === 'طرد') {
            if (!isAdmin && !member.permissions.has(PermissionsBitField.Flags.KickMembers))
                return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية الطرد.')], flags: 64 });
            const target = interaction.options.getMember('العضو');
            const reason = interaction.options.getString('السبب') || 'لم يُحدد سبب';
            if (!target?.kickable) return interaction.reply({ embeds: [errEmbed('لا أستطيع طرد هذا العضو.')], flags: 64 });
            await target.kick(reason);
            const embed = new EmbedBuilder().setTitle('👢 تم الطرد').setColor('Orange')
                .addFields({ name: '👤 العضو', value: target.user.tag, inline: true }, { name: '📝 السبب', value: reason, inline: true });
            await interaction.reply({ embeds: [embed] });
            await sendLog(interaction.guild, embed);
        }

        else if (cmd === 'حظر') {
            if (!isAdmin && !member.permissions.has(PermissionsBitField.Flags.BanMembers))
                return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية الحظر.')], flags: 64 });
            const target = interaction.options.getMember('العضو');
            const reason = interaction.options.getString('السبب') || 'لم يُحدد سبب';
            if (!target?.bannable) return interaction.reply({ embeds: [errEmbed('لا أستطيع حظر هذا العضو.')], flags: 64 });
            await target.ban({ reason });
            const embed = new EmbedBuilder().setTitle('🔨 تم الحظر').setColor('Red')
                .addFields({ name: '👤 العضو', value: target.user.tag, inline: true }, { name: '📝 السبب', value: reason, inline: true });
            await interaction.reply({ embeds: [embed] });
            await sendLog(interaction.guild, embed);
        }

        else if (cmd === 'فك-حظر') {
            if (!isAdmin && !member.permissions.has(PermissionsBitField.Flags.BanMembers))
                return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية.')], flags: 64 });
            const userId = interaction.options.getString('معرف_العضو');
            await interaction.guild.members.unban(userId).catch(() => {
                throw new Error('فشل فك الحظر — تأكد من صحة المعرف.');
            });
            await interaction.reply({ embeds: [okEmbed(`تم فك حظر العضو بمعرف \`${userId}\`.`)] });
        }

        else if (cmd === 'كتم') {
            if (!isMod) return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية الكتم.')], flags: 64 });
            const target  = interaction.options.getMember('العضو');
            const minutes = interaction.options.getInteger('المدة');
            const reason  = interaction.options.getString('السبب') || 'لم يُحدد سبب';
            if (!target) return interaction.reply({ embeds: [errEmbed('العضو غير موجود.')], flags: 64 });
            await target.timeout(minutes * 60 * 1000, reason);
            const embed = new EmbedBuilder().setTitle('🔇 تم الكتم').setColor('Orange')
                .addFields(
                    { name: '👤 العضو', value: target.user.tag,    inline: true },
                    { name: '⏱️ المدة', value: minutesToAr(minutes), inline: true },
                    { name: '📝 السبب', value: reason,              inline: true }
                );
            await interaction.reply({ embeds: [embed] });
            await sendLog(interaction.guild, embed);
        }

        else if (cmd === 'فك-كتم') {
            if (!isMod) return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية.')], flags: 64 });
            const target = interaction.options.getMember('العضو');
            if (!target) return interaction.reply({ embeds: [errEmbed('العضو غير موجود.')], flags: 64 });
            await target.timeout(null);
            await interaction.reply({ embeds: [okEmbed(`تم فك كتم ${target.user.tag}.`)] });
        }

        else if (cmd === 'مسح-رسائل') {
            if (!isAdmin && !member.permissions.has(PermissionsBitField.Flags.ManageMessages))
                return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية مسح الرسائل.')], flags: 64 });
            const amount = interaction.options.getInteger('العدد');
            await interaction.channel.bulkDelete(amount, true).catch(() => {});
            await interaction.reply({ embeds: [okEmbed(`تم مسح ${amount} رسالة.`)], flags: 64 });
        }

        // ===================================
        // ===== أوامر المعلومات =====
        // ===================================
        else if (cmd === 'معلومات-العضو') {
            const user   = interaction.options.getUser('العضو') || interaction.user;
            const target = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);
            const roles  = target?.roles.cache.filter(r => r.id !== interaction.guild.id).sort((a,b) => b.position - a.position).map(r => `${r}`).slice(0,10).join(', ') || 'لا يوجد';

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`👤 معلومات ${user.username}`)
                    .setThumbnail(user.displayAvatarURL({ size: 256 }))
                    .setColor(target?.displayHexColor || 'Blue')
                    .addFields(
                        { name: '🏷️ الاسم الكامل',    value: user.tag,                                                      inline: true },
                        { name: '🆔 المعرف',           value: user.id,                                                       inline: true },
                        { name: '🤖 بوت؟',             value: user.bot ? 'نعم' : 'لا',                                      inline: true },
                        { name: '📅 تاريخ الإنشاء',   value: `<t:${Math.floor(user.createdTimestamp/1000)}:F>`,             inline: true },
                        { name: '📥 تاريخ الانضمام',  value: target ? `<t:${Math.floor(target.joinedTimestamp/1000)}:F>` : '؟', inline: true },
                        { name: '🎨 اللقب',            value: target?.nickname || user.username,                             inline: true },
                        { name: '🎭 الرتب',            value: roles.length > 1024 ? roles.slice(0, 1021) + '...' : roles,   inline: false }
                    )
                    .setFooter({ text: `طلب بواسطة: ${interaction.user.tag}` })
                    .setTimestamp()
                ],
                flags: 64
            });
        }

        else if (cmd === 'معلومات-السيرفر') {
            const g = interaction.guild;
            const textCh   = g.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
            const voiceCh  = g.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
            const bots     = g.members.cache.filter(m => m.user.bot).size;
            const humans   = g.memberCount - bots;

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`🏠 معلومات ${g.name}`)
                    .setThumbnail(g.iconURL({ size: 256 }))
                    .setColor('Blue')
                    .addFields(
                        { name: '🆔 المعرف',         value: g.id,                                              inline: true },
                        { name: '👑 المالك',         value: `<@${g.ownerId}>`,                                 inline: true },
                        { name: '📅 أُنشئ',          value: `<t:${Math.floor(g.createdTimestamp/1000)}:F>`,   inline: true },
                        { name: '👥 الأعضاء',        value: `${g.memberCount} (${humans} بشر, ${bots} بوت)`, inline: true },
                        { name: '💬 القنوات النصية', value: `${textCh}`,                                       inline: true },
                        { name: '🔊 القنوات الصوتية', value: `${voiceCh}`,                                    inline: true },
                        { name: '🎭 الرتب',          value: `${g.roles.cache.size}`,                           inline: true },
                        { name: '😀 الإيموجي',       value: `${g.emojis.cache.size}`,                         inline: true },
                        { name: '🔒 مستوى الحماية',  value: `${g.verificationLevel}`,                         inline: true }
                    )
                    .setFooter({ text: `طلب بواسطة: ${interaction.user.tag}` })
                    .setTimestamp()
                ],
                flags: 64
            });
        }

        else if (cmd === 'معلومات-البوت') {
            const totalTickets  = Object.values(db.tickets).reduce((s, g) => s + Object.keys(g).length, 0);
            const totalWarnings = Object.values(db.warnings).reduce((s, g) => s + Object.values(g).reduce((a, w) => a + w.length, 0), 0);
            const uptime = process.uptime();
            const d = Math.floor(uptime / 86400);
            const h = Math.floor((uptime % 86400) / 3600);
            const m = Math.floor((uptime % 3600) / 60);
            const s = Math.floor(uptime % 60);

            // حساب إجمالي التفاعلات المضبوطة
            const totalReactChannels = Object.values(db.guildConfig).reduce((sum, cfg) => {
                return sum + (cfg.reactChannels ? Object.keys(cfg.reactChannels).length : 0);
            }, 0);

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`🤖 معلومات ${client.user.username}`)
                    .setThumbnail(client.user.displayAvatarURL())
                    .setColor('Purple')
                    .addFields(
                        { name: '🏷️ الاسم',              value: client.user.tag,                                  inline: true },
                        { name: '🆔 المعرف',              value: client.user.id,                                   inline: true },
                        { name: '⏱️ وقت التشغيل',        value: `${d}يوم ${h}س ${m}د ${s}ث`,                    inline: true },
                        { name: '🌐 السيرفرات',           value: `${client.guilds.cache.size}`,                    inline: true },
                        { name: '📩 إجمالي التذاكر',      value: `${totalTickets}`,                                inline: true },
                        { name: '⚠️ إجمالي التحذيرات',    value: `${totalWarnings}`,                               inline: true },
                        { name: '💬 قنوات التفاعل',       value: `${totalReactChannels}`,                          inline: true },
                        { name: '📚 المكتبة',              value: 'Discord.js v14',                                 inline: true },
                        { name: '💾 الذاكرة',              value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`, inline: true }
                    )
                    .setFooter({ text: 'Isekai Bot 🎲' })
                    .setTimestamp()
                ],
                flags: 64
            });
        }

        // ===================================
        // ===== الإعلانات =====
        // ===================================
        else if (cmd === 'إعلان') {
            if (!isAdmin && !member.permissions.has(PermissionsBitField.Flags.MentionEveryone))
                return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية إرسال الإعلانات.')], flags: 64 });

            const ch      = interaction.options.getChannel('القناة');
            const title   = interaction.options.getString('العنوان');
            const message = interaction.options.getString('الرسالة');
            const color   = interaction.options.getString('اللون') || 'Blue';
            const mention = interaction.options.getString('ذكر') || '';

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(message)
                .setColor(color)
                .setFooter({ text: `بواسطة: ${interaction.user.tag}` })
                .setTimestamp();

            await ch.send({ content: mention || undefined, embeds: [embed] });
            await interaction.reply({ embeds: [okEmbed(`تم إرسال الإعلان في ${ch}.`)], flags: 64 });
        }

        // ===================================
        // ===== أمر PetPet (سلاش) =====
        // ===================================
        else if (cmd === 'petpet') {
            const targetUser = interaction.options.getUser('العضو');
            await interaction.deferReply();

            try {
                const gifBuffer = await createPetpetGif(targetUser);
                if (!gifBuffer) {
                    return interaction.editReply({ embeds: [errEmbed('تعذّر تحميل صورة المستخدم، حاول مجدداً.')] });
                }
                const attachment = new AttachmentBuilder(gifBuffer, { name: 'petpet.gif' });
                await interaction.editReply({
                    content: `${interaction.user} يدلّع ${targetUser}`,
                    files: [attachment]
                });
            } catch (err) {
                console.error('خطأ في /petpet:', err);
                await interaction.editReply({ embeds: [errEmbed('حدث خطأ أثناء إنشاء الصورة.')] });
            }
        }

        // ===================================
        // ===== نظام التفاعلات التلقائية =====
        // ===================================
        else if (cmd === 'إعداد-تفاعل') {
            if (!isAdmin) return interaction.reply({ embeds: [errEmbed('هذا الأمر للمشرفين فقط.')], flags: 64 });

            const ch       = interaction.options.getChannel('القناة');
            const emojiStr = interaction.options.getString('الايموجي').trim();

            // التحقق من صحة الإيموجي
            const parsed = parseEmoji(emojiStr);
            let displayEmoji = emojiStr;
            let validEmoji   = false;

            if (typeof parsed === 'object') {
                // إيموجي مخصص — تحقق من وجوده في السيرفر أو أي سيرفر يعرفه البوت
                const foundEmoji = client.emojis.cache.get(parsed.id);
                if (foundEmoji) {
                    displayEmoji = foundEmoji.toString();
                    validEmoji   = true;
                } else {
                    // ربما الإيموجي من سيرفر آخر، نقبله على مسؤولية المستخدم
                    displayEmoji = emojiStr;
                    validEmoji   = true;
                }
            } else if (typeof parsed === 'string' && parsed.length > 0) {
                // إيموجي يونيكود عادي
                displayEmoji = parsed;
                validEmoji   = true;
            }

            if (!validEmoji) {
                return interaction.reply({ embeds: [errEmbed('الإيموجي غير صالح. أدخل إيموجي يونيكود أو إيموجي مخصص مثل `<:name:id>`.')], flags: 64 });
            }

            if (!db.guildConfig[guildId]) db.guildConfig[guildId] = {};
            if (!db.guildConfig[guildId].reactChannels) db.guildConfig[guildId].reactChannels = {};
            db.guildConfig[guildId].reactChannels[ch.id] = emojiStr;
            saveDB();

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ تم إعداد التفاعل التلقائي')
                    .setColor('Green')
                    .setDescription(`سيتفاعل البوت تلقائياً بـ ${displayEmoji} على كل رسالة في ${ch}`)
                    .addFields(
                        { name: '📢 القناة',  value: `${ch}`,         inline: true },
                        { name: '😀 الإيموجي', value: displayEmoji,   inline: true }
                    )
                    .setFooter({ text: 'تأكد من أن البوت لديه صلاحية إضافة التفاعلات في تلك القناة' })
                ],
                flags: 64
            });
        }

        else if (cmd === 'حذف-تفاعل') {
            if (!isAdmin) return interaction.reply({ embeds: [errEmbed('هذا الأمر للمشرفين فقط.')], flags: 64 });

            const ch = interaction.options.getChannel('القناة');
            const reactChannels = db.guildConfig?.[guildId]?.reactChannels;

            if (!reactChannels || !reactChannels[ch.id]) {
                return interaction.reply({ embeds: [errEmbed(`لا يوجد تفاعل تلقائي مضبوط على ${ch}.`)], flags: 64 });
            }

            delete db.guildConfig[guildId].reactChannels[ch.id];
            saveDB();

            await interaction.reply({ embeds: [okEmbed(`تم حذف التفاعل التلقائي من ${ch}.`)], flags: 64 });
        }

        else if (cmd === 'تفاعلات') {
            const reactChannels = db.guildConfig?.[guildId]?.reactChannels;

            if (!reactChannels || Object.keys(reactChannels).length === 0) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('💬 التفاعلات التلقائية')
                        .setColor('Blue')
                        .setDescription('لا توجد تفاعلات تلقائية مضبوطة.\nاستخدم `/إعداد-تفاعل` لإضافة تفاعل.')
                    ],
                    flags: 64
                });
            }

            const list = Object.entries(reactChannels)
                .map(([chId, emoji]) => `<#${chId}> — ${emoji}`)
                .join('\n');

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('💬 التفاعلات التلقائية')
                    .setColor('Blue')
                    .setDescription(list)
                    .setFooter({ text: `${Object.keys(reactChannels).length} قناة مضبوطة` })
                ],
                flags: 64
            });
        }

        // ===================================
        // ===== قائمة المساعدة =====
        // ===================================
        else if (cmd === 'مساعدة') {
            const embed = new EmbedBuilder()
                .setTitle('📖 دليل أوامر Isekai Bot')
                .setColor('Purple')
                .setThumbnail(client.user.displayAvatarURL())
                .addFields(
                    {
                        name: '🎫 نظام التذاكر',
                        value: [
                            '`/إعداد-تذاكر` — إعداد نظام التذاكر الكامل',
                            '`/إضافة-نوع-تذكرة` — إضافة نوع تذكرة جديد',
                            '`/حذف-نوع-تذكرة` — حذف نوع تذكرة',
                            '`/أنواع-التذاكر` — عرض الأنواع الحالية',
                            '`/إضافة-عضو` — إضافة عضو للتذكرة',
                            '`/إزالة-عضو` — إزالة عضو من التذكرة',
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '💬 التفاعلات التلقائية',
                        value: [
                            '`/إعداد-تفاعل` — ضبط تفاعل على قناة (يونيكود أو مخصص)',
                            '`/حذف-تفاعل` — إزالة تفاعل من قناة',
                            '`/تفاعلات` — عرض كل التفاعلات المضبوطة',
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '🎭 الموديريشن',
                        value: [
                            '`/تحذير` — تحذير عضو مع إبلاغه',
                            '`/تحذيرات` — عرض تحذيرات عضو',
                            '`/حذف-تحذير` — حذف تحذير محدد',
                            '`/مسح-تحذيرات` — مسح كل تحذيرات عضو',
                            '`/طرد` — طرد عضو',
                            '`/حظر` — حظر عضو',
                            '`/فك-حظر` — فك حظر عضو بالـ ID',
                            '`/كتم` — كتم عضو بمدة محددة',
                            '`/فك-كتم` — فك كتم عضو',
                            '`/مسح-رسائل` — مسح رسائل (2-100)',
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '🎲 المافيا والألعاب',
                        value: [
                            '`/إعداد-مافيا` — تعيين قناة المافيا',
                            '`!مافيا` — بدء لعبة المافيا في القناة المحددة',
                            '',
                            '**الأدوار:**',
                            '🔫 **المافيا** — تقتل ليلاً وتتظاهر بالبراءة نهاراً',
                            '💊 **الطبيب** — يحمي لاعباً واحداً كل ليلة',
                            '👤 **المواطن** — يصوّت لكشف المافيا',
                            '🃏 **المهرج** — يفوز إذا أُعدم بالتصويت! (5 لاعبين+)',
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '👋 الترحيب والوداع',
                        value: [
                            '`/إعداد-ترحيب` — رسالة ترحيب + رتبة تلقائية',
                            '`/إعداد-وداع` — رسالة وداع',
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '📊 المعلومات والأدوات',
                        value: [
                            '`/معلومات-العضو` — معلومات أي عضو',
                            '`/معلومات-السيرفر` — إحصائيات السيرفر',
                            '`/معلومات-البوت` — إحصائيات البوت',
                            '`/إعلان` — إرسال إعلان منسق',
                            '`/إعداد-لوق` — تعيين قناة اللوق',
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '🐾 الأوامر الممتعة',
                        value: [
                            '`/petpet @عضو` — اصنع GIF petpet واقعي',
                            '`!petpet @عضو` — نفس الأمر عبر البريفيكس',
                            '`!petpet` (مع رد على رسالة) — petpet لصاحب الرسالة',
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '✨ مشغّلات تلقائية',
                        value: [
                            '`الضريح الخبيث` — اكتب هذه الكلمة ليرد البوت',
                            '`الفراغ اللانهائي` — اكتب هذه الكلمة ليرد البوت',
                        ].join('\n'),
                        inline: false
                    }
                )
                .setFooter({ text: 'Isekai Bot 🎲 • استخدم / للبدء' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: 64 });
        }

        return;
    }

    // ===================================
    // ===== أزرار وقوائم منسدلة =====
    // ===================================
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const guildId = interaction.guild.id;

    function findType(typeId) {
        const custom = db.guildConfig?.[guildId]?.ticketTypes;
        if (custom?.length) return custom.find(t => t.id === typeId);
        return config.tickets.types.find(t => t.id === typeId);
    }

    // ===== قائمة منسدلة للتذاكر =====
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const type = findType(interaction.values[0]);
        if (!type) return interaction.reply({ embeds: [errEmbed('نوع تذكرة غير صالح.')], flags: 64 });
        const manager = new TicketManager(guildId);
        try {
            const ch = await manager.create(interaction.user, type);
            await interaction.reply({ embeds: [okEmbed(`تم فتح تذكرتك: ${ch}`)], flags: 64 });
        } catch (e) {
            await interaction.reply({ embeds: [errEmbed(e.message)], flags: 64 });
        }
        return;
    }

    const cid = interaction.customId;

    // ===== أزرار فتح التذكرة =====
    if (cid.startsWith('ticket_')) {
        const type = findType(cid.split('_')[1]);
        if (!type) return interaction.reply({ embeds: [errEmbed('نوع تذكرة غير صالح.')], flags: 64 });
        const manager = new TicketManager(guildId);
        try {
            const ch = await manager.create(interaction.user, type);
            await interaction.reply({ embeds: [okEmbed(`تم فتح تذكرتك: ${ch}`)], flags: 64 });
        } catch (e) {
            await interaction.reply({ embeds: [errEmbed(e.message)], flags: 64 });
        }
    }

    // ===== زر استلام التذكرة =====
    else if (cid.startsWith('claim_')) {
        const ticketId = cid.split('_')[1];
        const cfg2     = db.guildConfig?.[guildId] || {};
        const staffIds = [cfg2.staffRole1, cfg2.staffRole2].filter(Boolean);
        const isAdmin2 = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isStaff  = staffIds.some(r => interaction.member.roles.cache.has(r));
        if (!isAdmin2 && !isStaff) return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية استلام التذاكر.')], flags: 64 });

        const manager = new TicketManager(guildId);
        try {
            manager.claim(ticketId, interaction.user.id);
            await interaction.channel.send({ embeds: [new EmbedBuilder().setColor('Blue').setDescription(`🛄 تم استلام التذكرة بواسطة ${interaction.user}`)] });
            await interaction.reply({ embeds: [okEmbed('تم استلام التذكرة.')], flags: 64 });
            await sendLog(interaction.guild, new EmbedBuilder().setTitle('🛄 تم استلام تذكرة').setColor('Blue')
                .addFields(
                    { name: 'المستلم', value: `${interaction.user.tag}`, inline: true },
                    { name: 'القناة',  value: `${interaction.channel}`,  inline: true }
                ).setTimestamp()
            );
        } catch (e) {
            await interaction.reply({ embeds: [errEmbed(e.message)], flags: 64 });
        }
    }

    // ===== زر إغلاق التذكرة =====
    else if (cid.startsWith('close_')) {
        const ticketId = cid.split('_')[1];
        const cfg2     = db.guildConfig?.[guildId] || {};
        const staffIds = [cfg2.staffRole1, cfg2.staffRole2].filter(Boolean);
        const isAdmin2 = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isStaff  = staffIds.some(r => interaction.member.roles.cache.has(r));
        const ticket   = new TicketManager(guildId).get(ticketId);
        const isOwner  = ticket?.userId === interaction.user.id;

        if (!isAdmin2 && !isStaff && !isOwner)
            return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية إغلاق هذه التذكرة.')], flags: 64 });

        try {
            const manager = new TicketManager(guildId);
            await manager.close(ticketId, interaction.user.id, interaction.guild);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`reopen_${ticketId}`).setLabel('إعادة فتح').setEmoji('🔓').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`delete_${ticketId}`).setLabel('حذف نهائي').setEmoji('⛔').setStyle(ButtonStyle.Danger)
            );
            await interaction.channel.send({
                embeds: [new EmbedBuilder().setColor('Orange').setDescription(`🔒 تم إغلاق التذكرة بواسطة ${interaction.user}.\nتم إرسال ترانسكريبت لقناة اللوق.`)],
                components: [row]
            });
            await interaction.reply({ embeds: [okEmbed('تم إغلاق التذكرة.')], flags: 64 });
        } catch (e) {
            await interaction.reply({ embeds: [errEmbed(e.message)], flags: 64 });
        }
    }

    // ===== زر إعادة فتح التذكرة =====
    else if (cid.startsWith('reopen_')) {
        const ticketId = cid.split('_')[1];
        const cfg2     = db.guildConfig?.[guildId] || {};
        const staffIds = [cfg2.staffRole1, cfg2.staffRole2].filter(Boolean);
        const isAdmin2 = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isStaff  = staffIds.some(r => interaction.member.roles.cache.has(r));
        if (!isAdmin2 && !isStaff) return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية إعادة الفتح.')], flags: 64 });

        try {
            const manager = new TicketManager(guildId);
            await manager.reopen(ticketId, interaction.guild);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`claim_${ticketId}`).setLabel('استلام').setEmoji('🛄').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`close_${ticketId}`).setLabel('إغلاق').setEmoji('🔒').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`transcript_${ticketId}`).setLabel('ترانسكريبت').setEmoji('📄').setStyle(ButtonStyle.Secondary)
            );
            await interaction.channel.send({
                embeds: [new EmbedBuilder().setColor('Green').setDescription(`🔓 تمت إعادة فتح التذكرة بواسطة ${interaction.user}`)],
                components: [row]
            });
            await interaction.reply({ embeds: [okEmbed('تمت إعادة فتح التذكرة.')], flags: 64 });
        } catch (e) {
            await interaction.reply({ embeds: [errEmbed(e.message)], flags: 64 });
        }
    }

    // ===== زر الترانسكريبت =====
    else if (cid.startsWith('transcript_')) {
        const cfg2     = db.guildConfig?.[guildId] || {};
        const staffIds = [cfg2.staffRole1, cfg2.staffRole2].filter(Boolean);
        const isAdmin2 = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isStaff  = staffIds.some(r => interaction.member.roles.cache.has(r));
        if (!isAdmin2 && !isStaff) return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية جلب الترانسكريبت.')], flags: 64 });

        await interaction.deferReply({ flags: 64 });
        const ticketId = cid.split('_')[1];
        const text     = await generateTranscript(interaction.channel);
        const buf      = Buffer.from(text, 'utf8');
        const file     = new AttachmentBuilder(buf, { name: `transcript-${ticketId}.txt` });
        await interaction.editReply({ content: '📄 هذا ترانسكريبت القناة:', files: [file] });
    }

    // ===== زر حذف التذكرة =====
    else if (cid.startsWith('delete_')) {
        const ticketId = cid.split('_')[1];
        const cfg2     = db.guildConfig?.[guildId] || {};
        const staffIds = [cfg2.staffRole1, cfg2.staffRole2].filter(Boolean);
        const isAdmin2 = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isStaff  = staffIds.some(r => interaction.member.roles.cache.has(r));
        if (!isAdmin2 && !isStaff) return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية الحذف.')], flags: 64 });

        await interaction.reply({ embeds: [okEmbed('جاري حذف القناة...')], flags: 64 });
        const manager = new TicketManager(guildId);
        await manager.deleteTicket(ticketId, interaction.guild);
    }

    // ===== زر التقييم =====
    else if (cid.startsWith('rate_')) {
        const parts    = cid.split('_');
        const stars    = parseInt(parts[1]);
        const ticketId = parts[2];
        const starsStr = '⭐'.repeat(stars);

        await interaction.reply({ content: `✅ شكراً على تقييمك: ${starsStr}`, flags: 64 });

        const cfg2 = db.guildConfig?.[guildId] || {};
        if (cfg2.logChannelId) {
            const logCh = interaction.guild.channels.cache.get(cfg2.logChannelId);
            if (logCh) await logCh.send({
                embeds: [new EmbedBuilder()
                    .setTitle('⭐ تقييم تذكرة')
                    .setColor('Gold')
                    .addFields(
                        { name: '👤 المستخدم', value: `${interaction.user.tag}`, inline: true },
                        { name: '⭐ التقييم',  value: `${starsStr} (${stars}/5)`, inline: true },
                        { name: '🎫 التذكرة',  value: `#${ticketId}`,             inline: true }
                    )
                    .setTimestamp()
                ]
            }).catch(() => {});
        }
    }

    // ===== أزرار المافيا =====
    else {
        const game = mafiaGames[guildId];
        if (game) await game.handleInteraction(interaction);
    }
});

// ========== تسجيل الدخول ==========
client.login(process.env.DISCORD_TOKEN);
