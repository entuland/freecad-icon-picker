import { iconpaths } from "/png/iconpaths.js";

const data = {};
const src_by_name = {};
const canvases = [];
const level_prefix = "{LEVEL}";
const output = document.getElementById("output");
const status = document.getElementById("status");
const search = document.getElementById("search");
const status_reset_ms = 2000;
const default_status_string = "Click an icon to copy it raw and generate variants, click generated variant to copy it instead";

let timeout_handle;
let debounce_interval = 500;
let debounce_handle;
let latest_button_callback;

createInterface();

function createInterface() {
	prepareData();
	createCanvases();
	
	status.textContent = default_status_string;
	search.addEventListener("input", runSearch);
	
	const buttons = document.getElementById("buttons");
	document.getElementById("canvases").append(...canvases);
	
	let initialize;
	traverseObject(data, processEntry);
	initialize?.();
	
	function processEntry({ key, value }) {
		if(typeof value == "string") {
			console.error("processEntry()", { key, value });
			setError("Invalid entry in processEntry, check console");
			return;
		}
		appendButton(key, value);
	}
	
	function appendButton(key, value) {
		const button = document.createElement("button");
		button.classList.add("button", "flex");
		
		const stripped_key = key.replace(level_prefix, "");
		
		const src = src_by_name[stripped_key + "Workbench"];
		
		button.append(stripped_key);
		
		if(src != null) {
			const icon = document.createElement("img");
			icon.classList.add("icon");
			icon.src = src;
			button.append(icon);
		}
		
		button.addEventListener("click", onButtonClicked);
		
		if(!initialize) {
			initialize = onButtonClicked;
		}
		
		buttons.append(button);
		
		function onButtonClicked() {
			latest_button_callback = onButtonClicked;
			buttons.querySelectorAll(".button.active").forEach(b => b.classList.remove("active"));
			button.classList.add("active");
			populateSection(key, value, output);
		}
	}
}

function runSearch() {
	
	clearTimeout(debounce_handle);
	
	debounce_handle = setTimeout(runSearchInternal, debounce_interval);
	
	function runSearchInternal() {
		try {
			let text = search.value.trim();
			if(text == "") {
				latest_button_callback?.();
				return;
			}
			runRegexSearch(new RegExp(search.value, "gi"));
		} catch(err) {
			console.error("runSearchInternal()", err);
			setError("Invalid regex search pattern");
		}
	}
	
	function runRegexSearch(regex) {
		const icons = [];
		
		const names = Object.keys(src_by_name).filter(name => name.match(regex));
		
		if(!names.length) {
			setError("No matching icons found");
			return;
		}
		
		output.textContent = "";
		
		names.forEach(name => {
			appendIcon(name, src_by_name[name], output);
		});		
	}
}

function setStatus(text, type = "alert") {
	status.textContent = text;
	status.classList.value = "";
	status.classList.add(type);
	clearTimeout(timeout_handle);
	timeout_handle = setTimeout(() => {
		status.classList.value = "";
		status.textContent = default_status_string;		
	}, status_reset_ms);
}

function setError(text) {
	setStatus(text, "error");
}

function createCanvases() {
	for(let i = 0; i < 4; ++i) {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 0;
		canvas.title = "click to copy this variant";
		canvas.addEventListener("click", () => {
			copyToClipboard(canvas);
		});
		canvases.push(canvas);
	}
}

function populateSection(mod, children, container) {
	const root_wrapper = createWrapper();
	
	const containers = {};
	
	traverseObject(children, ({ key, value }) => {
		processEntry({ key, value, container: root_wrapper });
	});
	
	container.replaceChildren(root_wrapper, ...Object.values(containers));
	
	function createWrapper() {
		const wrapper = document.createElement("div");
		wrapper.classList.add("contents", "flex");
		return wrapper;
	}
	
	function processEntry({ key, value, container }) {
		if(typeof value == "string") {
			appendIcon(key, value, container);
		} else {
			key = key.replace(level_prefix, "");
			if(!containers[key]) {
				containers[key] = createWrapper();
				const intro = document.createElement("div");
				intro.classList.add("intro");
				intro.textContent = key;
				containers[key].append(intro);
			}
			container = containers[key];
			traverseObject(value, ({ key, value }) => {
				processEntry({ key, value, container });
			});
		}
	}
}

function appendIcon(name, src, container) {
	const icon = document.createElement("img");
	icon.title = name + "\n\nclick to copy and generate variants";
	icon.classList.add("icon");
	icon.src = src;
	
	icon.addEventListener("click", printIcons);
	
	container.append(icon);
	
	const font = "16px sans-serif";
	
	function printIcons() {
		copyToClipboard(icon);
		
		printIcon(canvases[0]);
		
		const w = canvases[0].width;
		const h = canvases[0].height;
		
		const backgrounds = [
			"hsl(0 0% 10%)",
			"hsl(0 0% 50%)",
			"hsl(0 0% 90%)",
		];
		
		canvases.slice(1).forEach((canvas, index) => {
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext("2d");
			ctx.fillStyle = backgrounds[index];
			ctx.fillRect(w/2 - 68/2, 0, 68, 68);
			ctx.drawImage(canvases[0], 0, 0);
		});			
	}
	
	function printIcon(canvas) {
		const ctx = canvas.getContext("2d");
		
		ctx.font = font;
		
		let metrics = ctx.measureText(" " + name + " ");
		const height_metrics = ctx.measureText("Aq");
		
		const height = height_metrics.actualBoundingBoxAscent + height_metrics.actualBoundingBoxDescent + 8;
		
		canvas.width = Math.max(metrics.width, 68);
		canvas.height = height + 64;
		
		ctx.font = font;
		ctx.fillStyle = "black";
		
		let start = canvas.width / 2 - metrics.width / 2;
		ctx.fillRect(start, 66, metrics.width, height);
		
		metrics = ctx.measureText(name);
		start = canvas.width / 2 - metrics.width / 2;
		ctx.fillStyle = "white";
		
		ctx.fillText(name, start, 70 + metrics.actualBoundingBoxAscent);
		ctx.drawImage(icon, canvas.width / 2 - 32, 0, 64, 64);
	}
}

function traverseObject(obj, callback) {
	for(const key in obj) {
		const value = obj[key];
		callback({ key, value });
	}
}

function prepareData() {
	const identifiers = Object.keys(iconpaths);
	identifiers.sort();
	
	identifiers.forEach(identifier => {
		const structure = identifier.split(":");
		
		const name = structure.pop();
		
		const path = iconpaths[identifier];
		
		src_by_name[name] = path;
		
		let current = data;
		
		while(structure.length) {
			const level = level_prefix + structure.shift();
			if(!current[level]) {
				current[level] = {};
			}
			current = current[level];
		}
		
		current[name] = path;			
	});
}

function copyToClipboard(element) {
	let canvas;

	if (element instanceof HTMLCanvasElement) {
		canvas = element;
	} else if (element instanceof HTMLImageElement) {
		canvas = document.createElement("canvas");
		canvas.width = element.naturalWidth;
		canvas.height = element.naturalHeight;
		const ctx = canvas.getContext("2d");
		ctx.drawImage(element, 0, 0);
	} else {
		setError("Element must be an <img> or <canvas>");
		return;
	}

	canvas.toBlob(blob => {
		if (!blob) {
			setError("Failed to create blob");
			return;
		}

		const item = new ClipboardItem({ [blob.type]: blob });

		navigator.clipboard.write([item])
			.then(() => setStatus("Image copied to clipboard!"))
			.catch(err => {
				console.error(err);
				setError("Clipboard write failed, check console");
			});
		
	}, "image/png");
}
