import { iconpaths } from "../png/iconpaths.js";

const data = {};
const src_by_name = {};
const canvases = [];
const level_prefix = "{LEVEL}";
const output = document.getElementById("output");
const status = document.getElementById("status");
const search = document.getElementById("search");
const canvases_wrapper = document.getElementById("canvases");
const status_reset_ms = 2000;
const default_status_string = "Click an icon to copy it raw and generate variants, click generated variant to copy it instead, doubleclick either the icon or a variant to download it";

let timeout_handle;
let debounce_interval = 500;
let debounce_handle;
let latest_button_callback;

createInterface();

function createInterface() {
	canvases_wrapper.style.display = "none";
	
	prepareData();
	prepareCanvases();
	
	status.textContent = default_status_string;
	search.addEventListener("input", runSearch);
	
	const buttons = document.getElementById("buttons");
	
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
			search.value = "";
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

function prepareCanvases() {
	for(let i = 0; i < 4; ++i) {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 0;
		canvas.title = "click to copy this variant, doubleclick to download it";
		
		canvas.addEventListener("click", () => {
			copyToClipboard(canvas);
		});
		
		canvas.addEventListener("dblclick", () => {
			downloadCanvas(canvas, canvas.dataset.name);
		});
		
		const wrapper = document.createElement("div");
		wrapper.classList.add("canvas-wrapper");
		
		const download_button = document.createElement("button");
		download_button.classList.add("button");
		download_button.textContent = "📥";
		download_button.title = "download this variant";
		
		download_button.addEventListener("click", () => {
			downloadCanvas(canvas, canvas.dataset.name);
		});
		
		const copy_button = document.createElement("button");
		copy_button.classList.add("button");
		copy_button.textContent = "📋";
		copy_button.title = "copy this variant to clipboard";
		
		copy_button.addEventListener("click", () => {
			copyToClipboard(canvas);
		});
		
		const buttons = document.createElement("div");
		buttons.classList.add("copy-download-buttons");
		
		buttons.append(download_button, copy_button);
		
		wrapper.append(canvas, buttons);
		
		canvases_wrapper.append(wrapper);
		
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
	icon.title = name + "\n\nclick to copy and generate variants\n\ndoubleclick to download";
	icon.classList.add("icon");
	icon.src = src;
	
	icon.addEventListener("click", printIcons);
	icon.addEventListener("dblclick", () => downloadIcon(icon, name + ".png"));
	
	container.append(icon);
	
	const font = "16px sans-serif";
	const img_padding = 4;
	
	const backgrounds = {
		dark: "hsl(0 0% 10%)",
		gray: "hsl(0 0% 50%)",
		light: "hsl(0 0% 90%)",
	};
	
	const bg_keys = Object.keys(backgrounds);
	const bg_values = Object.values(backgrounds);
	
	
	function printIcons() {
		canvases_wrapper.style.display = "";
		
		copyToClipboard(icon);
		
		const img_w = icon.naturalWidth + img_padding;
		const img_h = icon.naturalHeight + img_padding;
		
		const transparent_canvas = canvases[0];
		
		printIcon(transparent_canvas, img_w, img_h);
		
		transparent_canvas.dataset.name = name + "-transparent.png";
		
		const w = transparent_canvas.width;
		const h = transparent_canvas.height;
		
		canvases.slice(1).forEach((canvas, index) => {
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext("2d");
			ctx.fillStyle = bg_values[index];
			ctx.fillRect(w/2 - img_w/2, 0, img_w, img_h);
			ctx.drawImage(transparent_canvas, 0, 0);
			canvas.dataset.name = name + "-" + bg_keys[index] + ".png";
		});			
	}
	
	function printIcon(canvas, img_w, img_h) {
		const ctx = canvas.getContext("2d");
		
		const text_rendering_added_height = 8;
		
		ctx.font = font;
		
		let metrics = ctx.measureText(" " + name + " ");
		const height_metrics = ctx.measureText("Aq");
		
		const height = height_metrics.actualBoundingBoxAscent + height_metrics.actualBoundingBoxDescent + text_rendering_added_height;
		
		canvas.width = Math.max(metrics.width, img_w);
		canvas.height = height + img_h;
		
		ctx.font = font;
		ctx.fillStyle = "black";
		
		let start = canvas.width / 2 - metrics.width / 2;
		ctx.fillRect(start, img_h, metrics.width, height);
		
		metrics = ctx.measureText(name);
		start = canvas.width / 2 - metrics.width / 2;
		ctx.fillStyle = "white";
		
		ctx.fillText(name, start, img_h + metrics.actualBoundingBoxAscent + text_rendering_added_height/2);
		ctx.drawImage(icon, canvas.width/2 - img_w/2, 0, img_w, img_h);
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

function downloadIcon(icon, filename) {
	const canvas = document.createElement("canvas");
	canvas.width = icon.naturalWidth;
	canvas.height = icon.naturalHeight;
	const ctx = canvas.getContext("2d")
	ctx.drawImage(icon, 0, 0);
	downloadCanvas(canvas, filename);
}

function downloadCanvas(canvas, filename) {
	const dataUrl = canvas.toDataURL("image/png");
	const link = document.createElement("a");
	link.download = filename;
	link.href = dataUrl;
	link.click();
}

