import fetch from 'node-fetch';
import WS from 'ws';
import * as Misskey from 'misskey-js';
import { readFileSync } from 'node:fs';
import { Client, EmbedBuilder, Events, GatewayIntentBits } from 'discord.js';

const config = JSON.parse(readFileSync('./conf.json', { encoding: 'utf-8' }));

const client = new Client({
	intents: [
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildPresences,
		GatewayIntentBits.GuildWebhooks,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessageTyping,
		GatewayIntentBits.GuildMessageReactions,
	]
});

let guildChannel = null;

client.once(Events.ClientReady, c => {
	console.log(`discord: Ready! Logged in as ${c.user.tag}`);

	console.log('discord: get your guild...');

	const g = c.guilds.cache.get(config.guildId);
	if (g == null) {
		console.log('discord: err. not found guild from cache.');
		return;
	}
	console.log(`discord: get guild: ${g.name}`);
	guildChannel = g.channels.cache.get(config.channelId);
	if (guildChannel == null) {
		console.log('discord: err. not found channel from cache.');
		return;
	}
	if (!guildChannel.isTextBased()) {
		console.log('discord: err. channel is not text channel.');
		return;
	}
	console.log(`discord: get channel: ${guildChannel.name}`);

	console.log('discord: get channel success!');
});

client.login(config.discordToken);

const host = 'https://misskey.secinet.jp';
const token = config.misskeyToken;
const api = new Misskey.api.APIClient({
	origin: host,
	credential: token,
	fetch: (...args) => fetch(...args)
});

const ts = new Misskey.Stream(host, { token }, { WebSocket: WS });
const adminC = ts.useChannel('admin');
adminC.on('newAbuseUserReport', async v => {
	//console.log('misskey:', v);
	const users = await api.request('users/show', { userIds: [v.targetUserId, v.reporterId] });
	//console.log('misskey:', users);
	const targetUser = users.find(u => u.id === v.targetUserId);
	const reporter = users.find(u => u.id === v.reporterId);

	if (guildChannel != null) {
		await guildChannel.send({
			embeds: [
				new EmbedBuilder()
					.setAuthor({
						name: `@${targetUser?.username}`,
						iconURL: targetUser?.avatarUrl,
						url: `${host}/@${targetUser?.username}`
					})
					.setDescription(v.comment)
					.setColor('#f32323')
					.setFooter({
						text: `通報者: @${reporter?.username}`,
						iconURL: reporter?.avatarUrl
					})
					.setTimestamp(Date.now())
			]
		});
	}
});

ts.on("_connected_", () => {
	console.log("misskey: connected!");
});

ts.on("_disconnected_", () => {
	console.log("misskey: dis connected...");
});
