import * as fs from "fs";
import * as readline from "readline";

interface ScanResult {
	root: string;
	date: string;
	result: NodeInfo;
}

interface NodeInfo {
	name: string;
	size: number;
	children?: NodeInfo[];
	error?: string;
}

function report(path: string) {
	let streamCols = process.stdout.columns;
	readline.cursorTo(process.stdout, 0);
	readline.clearLine(process.stdout, 0);
	let procText = "processing: "
	process.stdout.write(procText);
	process.stdout.write(path.substr(0, streamCols - procText.length));
}

function iterateDir(path: string, name: string): NodeInfo {
	report(path);
	path = path.endsWith("/") ? path : `${path}/`;

	try {
		let children = fs.readdirSync(path, { withFileTypes: true });
		let files: NodeInfo = {
			name: "<files>",
			size: 0
		};
		let subDirs: NodeInfo[] = [];
		for (let child of children) {
			let childPath = path + child.name;
			if (child.isFile()) {
				try {
					files.size += fs.lstatSync(childPath).size;
				}
				catch (err) {

				}
			}
			else if (child.isDirectory()) {
				subDirs.push(iterateDir(childPath, child.name));
			}
		}

		if (files.size > 0)
			subDirs.push(files);

		return {
			name: name,
			size: subDirs.reduce((prev, curr) => prev + curr.size, 0),
			children: subDirs
		};
	}
	catch (err) {
		return {
			name: name,
			size: 0,
			error: JSON.stringify(err)
		};
	}
}

function displayBytes(bytes: number): string {
	if (bytes < 1024) {
		return bytes.toString();
	}
	bytes = Math.floor(bytes / 1024);
	if (bytes < 1024) {
		return `${bytes}k`;
	}
	bytes = Math.floor(bytes / 1024);
	if (bytes < 1024) {
		return `${bytes}M`;
	}
	bytes = Math.floor(bytes / 1024);
	return `${bytes}G`;
}

class ResultDisplayer {

	private listOffset: number = 0;
	private currentNode: NodeInfo;
	private breadCrumb: NodeInfo[] = [];
	private cx: number = 0;
	private cy: number = 0;

	private rows() { return process.stdout.rows; }
	private columns() { return process.stdout.columns; }

	private readonly headerHeight = 3;
	private currentIndex() { return this.cy - this.headerHeight + this.listOffset; }
	private isInLastRow() { return this.cy >= this.rows() - 1; }
	private isInFirstRow() { return this.cy <= this.headerHeight; }

	constructor(private scan: ScanResult) { }

	public start() {
		this.currentNode = this.scan.result;
		this.breadCrumb.push(this.currentNode);

		readline.emitKeypressEvents(process.stdin);
		process.stdin.setRawMode(true);
		process.stdin.on('keypress', (str, key) => {
			if (key.ctrl && key.name === 'c') {
				console.clear();
				process.exit();
			} else {
				this.handleKey(key.name);
			}
		});

		this.render();
	}

	private handleKey(name: string) {
		switch (name) {
			case "up": this.move(-1); break;
			case "down": this.move(1); break;
			case "left":
			case "escape": this.moveBack();
			case "return": this.moveInto();

		}
	}

	private moveInto() {
		let node = this.currentNode.children[this.currentIndex()];
		if (node && node.children) {
			this.breadCrumb.push(node);
			this.render();
		}
	}

	private moveBack() {
		if (this.breadCrumb.length > 1) {
			this.breadCrumb.pop();
			this.render();
		}
	}

	private move(dy: number) {
		let nextIdx = this.currentIndex() + dy;

		// out of bounds check
		if (nextIdx < 0 || nextIdx >= this.currentNode.children.length) {
			return;
		}

		if (this.isInFirstRow() && dy === -1) {
			// scroll up
			this.moveCursor(0, this.headerHeight);
			this.listOffset--;
			this.renderList();

			this.moveCursor(0, this.headerHeight);
			this.renderCursor();
		}
		else if (this.isInLastRow() && dy === 1) {
			// scroll down
			this.moveCursor(0, this.headerHeight);
			this.listOffset++;
			this.renderList();

			this.moveCursor(0, this.columns() - 1);
			this.renderCursor();
		}
		else {
			this.moveCursor(0, this.cy);
			this.renderEmptyCursor();
			this.moveCursor(0, this.cy + dy);
			this.renderCursor();
		}
	}

	private write(txt: string) {
		let remaining = this.columns() - this.cx;
		if (remaining > 0) {
			let trunc = txt.substr(0, remaining);
			process.stdout.write(trunc);
			this.cx += trunc.length;
		}
	}

	private writeRight(txt: string, padChar?: string) {
		let remaining = this.columns() - this.cx;
		if (remaining > 0) {
			if (txt.length >= remaining) {
				this.write(txt);
			}
			else {
				let toPad = remaining - txt.length;
				this.write((padChar || ".")[0].repeat(toPad));
				this.write(txt);
			}
		}
	}

	private writeLine() {
		process.stdout.write("\n");
		this.cx = 0;
		this.cy++;
	}

	private render() {
		console.clear();
		this.cx = 0;
		this.cy = 0;

		this.write(`Scan of ${this.scan.root} made on ${this.scan.date}`);
		this.writeLine();
		let path = this.breadCrumb.map((v, idx) => idx === 0 ? this.scan.root : v.name).join("/");
		this.write(`Showing: ${path}`);
		this.writeLine();
		this.writeLine();

		this.renderList();

		this.moveCursor(0, this.headerHeight);

		this.renderCursor();
	}

	private renderList() {
		this.moveCursor(0, this.headerHeight);
		for (let i = this.listOffset; i < this.currentNode.children.length; i++) {
			this.renderRow(this.currentNode.children![i])
			if (!this.isInLastRow()) {
				this.writeLine();
			}
		}
	}

	private renderRow(item: NodeInfo) {
		this.renderEmptyCursor();
		this.write(" ");
		this.write(item.name);
		this.writeRight(displayBytes(item.size));
	}

	private renderEmptyCursor() {
		this.write("   ");
	}

	private renderCursor() {
		this.write(" > ");
	}

	private moveCursor(x: number, y: number) {
		this.cx = x;
		this.cy = y;
		process.stdout.cursorTo(x, y);
	}
}

function mainScan() {
	let resultFile = process.argv[2];
	let resultJson = fs.readFileSync(resultFile, 'utf8');
	let result = JSON.parse(resultJson);
	let displayer = new ResultDisplayer(result);
	displayer.start();
}

function main() {
	let root = process.argv[2];
	let outFile = process.argv[3];
	let inputOk = root && fs.existsSync(root) && fs.lstatSync(root).isDirectory() && outFile;
	if (!inputOk) {
		console.log("please specify a directory and an output file");
		return;
	}
	let result = iterateDir(root, "<root>");

	let scanResult: ScanResult = {
		root,
		date: new Date().toISOString(),
		result
	}
	let outData = JSON.stringify(scanResult, undefined, 4)
	if (outFile) {
		fs.writeFileSync(outFile, outData);
	}
	else {
		console.log(outData);
	}
}

main();
// mainScan();
