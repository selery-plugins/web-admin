/*
 * Copyright (c) 2018 sel-project
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */
module selery.webadmin.hub;

import std.concurrency : spawn;
import std.random : uniform;
import std.string : replace, startsWith, split;

import selery.hub.plugin;
import selery.plugin : Plugin;

import lighttp;

// test
import std.stdio : writeln;

struct Address {

	string ip;
	ushort port;

}

class Main : HubPlugin {

	@start onStart() {
		spawn(&startWebAdmin, server, plugin, [Address("127.0.0.1", 19134)].idup);
	}

}

void startWebAdmin(shared HubServer server, shared Plugin plugin, immutable(Address)[] addresses) {

	auto http = new Server(new WebAdminRouter(server, cast()plugin));
	foreach(address ; addresses) {
		http.host(address.ip, address.port);
	}
	
	while(true) http.eventLoop.loop();

}

class WebAdminRouter : Router {

	private shared HubServer server;
	private Plugin plugin;
	
	private string[string] sessions;
	
	Resource[string] login, admin; // cached for every supported language
	
	@Get("main.css") Resource main;
	
	@Get("res", "bg32.png") Resource bg;
	@Get("res", "lock_locked.png") Resource lockLocked;
	@Get("res", "lock_unlocked.png") Resource lockUnlocked;
	
	this(shared HubServer server, Plugin plugin) {
		this.server = server;
		this.plugin = plugin;
		string login = (cast(string)server.files.readPluginAsset(plugin, "login.html")).replace("$STYLE", cast(string)server.files.readPluginAsset(plugin, "css/login.css")).replace("$SCRIPT", cast(string)server.files.readPluginAsset(plugin, "js/login.js"));
		string admin = (cast(string)server.files.readPluginAsset(plugin, "admin.html")).replace("$STYLE", cast(string)server.files.readPluginAsset(plugin, "css/admin.css")).replace("$SCRIPT", cast(string)server.files.readPluginAsset(plugin, "js/admin.js"));
		foreach(lang ; server.config.lang.acceptedLanguages) {
			this.login[lang] = new CachedResource("text/html", login);
			this.admin[lang] = new CachedResource("text/html", admin);
		}
		this.main = new CachedResource("text/css", server.files.readPluginAsset(plugin, "css/main.css"));
		this.bg = new CachedResource("image/png", server.files.readPluginAsset(plugin, "res/bg32.png"));
		this.lockLocked = new CachedResource("image/png", server.files.readPluginAsset(plugin, "res/lock_locked.png"));
		this.lockUnlocked = new CachedResource("image/png", server.files.readPluginAsset(plugin, "res/lock_unlocked.png"));
	}
	
	@Get("") getIndex(NetworkAddress address, Request req, Response res) {
		bool auth = false;
		auto cookie = "cookie" in req.headers;
		if(cookie) writeln(*cookie);
		if(cookie && startsWith(*cookie, "key=")) {
			auto ip = (*cookie)[4..$] in this.sessions;
			if(ip && *ip == address.toAddressString()) auth = true;
		}
		writeln(auth);
		// send login page or create a session
		if(auth) {
			// just logged in, needs the admin panel
			this.admin[this.getClientLanguage(req)].apply(req, res);
		} else if(true/*this.server.config.hub.webAdminPassword.length*/) { //TODO
			// password is required, send login form
			writeln(this.getClientLanguage(req));
			this.login[this.getClientLanguage(req)].apply(req, res);
		} else {
			// not logged in, but password is not required
			immutable key = this.addClient(address.toAddressString());
			if(key.length) {
				res.headers["Set-Cookie"] = "key=" ~ key;
				this.admin[this.getClientLanguage(req)].apply(req, res);
			} else {
				res.status = StatusCodes.notAcceptable;
			}
		}
	}
	
	@Post("login") postLogin() {
		
	}
	
	private string getClientLanguage(Request request) {
		auto lang = "accept-language" in request.headers;
		if(lang) {
			foreach(l1 ; split(*lang, ";")) {
				foreach(l2 ; split(l1, ",")) {
					if(l2.length == 5 || l2.length == 6) {
						return this.server.config.lang.best(l2.replace("-", "_"));
					}
				}
			}
		}
		return this.server.config.lang.language;
	}
	
	private string addClient(string address) {
		immutable key = randomKey();
		this.sessions[key] = address;
		return key;
	}
	
	@Get("ws") class Client : WebSocket {
	
		void onConnect() {}
		
		override void onReceive(ubyte[] buffer) {}
		
		override void onClose() {}
	
	}

}

private enum keys = "abcdefghijklmonpqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-+$!";

private @property string randomKey() {
	char[] key = new char[24];
	foreach(ref char c ; key) {
		c = keys[uniform!"[)"(0, keys.length)];
	}
	return key.idup;
}
