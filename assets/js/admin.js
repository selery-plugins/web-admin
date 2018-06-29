
var current_tab;

var animation;
var animation_dots;

var server = null;
var connected = false;

var lang = {};

var worlds = {};
var players = {};

var next_id;
var commands = {};
var logs = {};

window.onload = function(){
	if(location.hash !== "#app") {
		document.getElementById("close").style.display = "none";
		document.getElementById("conn_todo").style.display = "none";
		document.getElementById("retry").style.display = "block";
	}
	function setOnClick(button, tab) {
		button.onclick = function(){ changeView(tab); };
	}
	var tabs = document.getElementsByClassName("tab_button");
	for(var i=0; i<tabs.length; i++) {
		var tab = tabs[i];
		var name = tab.id.substr(0, tab.id.indexOf("_"));
		setOnClick(tab, name);
		if(tab.classList.contains("selected")) {
			current_tab = name;
		}
	}
	next_id = Math.round(Math.random() * 2000000 + 10000);
	document.getElementById("console_input_text").onkeydown = function(event){
		console.log(event.keyCode);
		if(event.keyCode == 13) {
			var issued = event.target.value.trim();
			if(issued.length) {
				server.send(JSON.stringify({id: "command", command: issued, command_id: next_id}));
				commands[next_id] = issued;
				event.target.value = "";
				next_id++;
			}
		}
	}
	connect();
}

function changeView(tab) {
	if(tab != current_tab) {
		console.log(tab);
		document.getElementById(current_tab).style.display = "none";
		document.getElementById(current_tab + "_button").classList.remove("selected");
		document.getElementById(tab).style.display = "block";
		document.getElementById(tab + "_button").classList.add("selected");
		current_tab = tab;
	}
}

function connect() {
	if(server != null) return;
	document.title = document.getElementById("alert_title").innerHTML = TITLE_CONNECTING;
	document.getElementById("alert").style.display = "none";
	document.getElementById("loading").style.display = "block";
	document.getElementById("console_messages").innerHTML = ""; // clear console
	animation_dots = "";
	animation = setInterval(function(){
		if(animation_dots.length == 3) animation_dots = "";
		else animation_dots += ".";
		document.getElementById("connecting_text").innerHTML = TITLE_CONNECTING + animation_dots;
	}, 200);
	server = new WebSocket("ws://" + location.host);
	server.onerror = error;
	server.onclose = error;
	server.onopen = function(){
		clearInterval(animation);
		connected = true;
		document.getElementById("loading").style.display = "none";
		document.getElementById("main").style.display = "block";
		//TODO reset data
	}
	server.onmessage = handleHub;
}

function error(event) {
	clearInterval(animation);
	document.title = document.getElementById("alert_title").innerHTML = TITLE_ERROR;
	document.getElementById("loading").style.display = "none";
	document.getElementById("main").style.display = "none";
	document.getElementById("alert").style.display = "block";
	if(connected) {
		document.getElementById("conn_closed").style.display = "block";
		document.getElementById("conn_error").style.display = "none";
	} else {
		document.getElementById("conn_error").style.display = "block";
		document.getElementById("conn_closed").style.display = "none";
	}
	server = null;
	connected = false;
}

function handleHub(event) {
	var json = JSON.parse(event.data);
	console.log(json);
	switch(json.packet) {
		case "lang":
			for(var key in json.data) {
				lang[key] = json.data[key];
			}
			break;
		case "settings":
			
			break;
		case "add_world":
			worlds[json.id] = {id: json.id, name: json.name, dimension: json.dimension, parent: json.parent || -1};
			//TODO update list
			break;
		case "remove_world":
			delete worlds[json.id];
			//TODO update list
			break;
		case "add_player":
		
			break;
		case "remove_player":
		
			break;
		case "log":
			var log = "";
			for(var message of json.log) {
				if(message.text) log += message.text;
				else log += translate(message.translation, message.with);
			}
			var cm = document.getElementById("console_messages");
			var scroll = cm.scrollTop + cm.offsetHeight == cm.scrollHeight; // scrolled by user
			var message = document.createElement("p");
			message.classList.add("console_message");
			message.innerText = log;
			message.innerHTML = format(message.innerHTML);
			//TODO popup event info
			cm.appendChild(message);
			if(scroll) cm.scrollTop = cm.scrollHeight;
			break;
		default:
			break;
	}
}

function translate(message, params) {
	var t = lang[message];
	if(t == undefined) return message;
	if(params != undefined) {
		for(var i in params) {
			t = t.replace("{" + i + "}", params[i]);
		}
	}
	return t;
}

function format(str) {
	var f = str;
	f = f.replace(/\u00A70|{black}/gmi, "<span style='color:#000'>");
	f = f.replace(/\u00A71|{dark_blue}/gmi, "<span style='color:#00A'>");
	f = f.replace(/\u00A72|{dark_green}/gmi, "<span style='color:#0A0'>");
	f = f.replace(/\u00A73|{dark_aqua}/gmi, "<span style='color:#0AA'>");
	f = f.replace(/\u00A74|{dark_red}/gmi, "<span style='color:#A00'>");
	f = f.replace(/\u00A75|{dark_purple}/gmi, "<span style='color:#A0A'>");
	f = f.replace(/\u00A76|{gold}/gmi, "<span style='color:#FA0'>");
	f = f.replace(/\u00A77|{gray}/gmi, "<span style='color:#AAA'>");
	f = f.replace(/\u00A78|{dark_gray}/gmi, "<span style='color:#555'>");
	f = f.replace(/\u00A79|{blue}/gmi, "<span style='color:#55F'>");
	f = f.replace(/\u00A7a|{green}/gmi, "<span style='color:#5F5'>");
	f = f.replace(/\u00A7b|{aqua}/gmi, "<span style='color:#5FF'>");
	f = f.replace(/\u00A7c|{red}/gmi, "<span style='color:#F55'>");
	f = f.replace(/\u00A7d|{light_purple}/gmi, "<span style='color:#F5F'>");
	f = f.replace(/\u00A7e|{yellow}/gmi, "<span style='color:#FF5'>");
	f = f.replace(/\u00A7f|{white}/gmi, "<span style='color:#FFF'>");
	f = f.replace(/\u00A7l|\u00A7m|{bold}/gmi, "<span style='font-weight:bold'>");
	f = f.replace(/\u00A7r|{normal}/gmi, "</span>");
	f = f.replace(/\u00A7k|\u00A7o|\u00A7n/gmi, "");
	var matches = f.match(/<span/g);
	for(var i in matches) {
		f += "</span>";
	}
	return f;
}

function unformat(str) {
	return str.replace(/\u00A7[a-fA-F0-9k-or]/gmi, "");
}
