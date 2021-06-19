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

$(() => {
	let $main = $("#main");
	let $meta = $("#metadata");
	let $file = $("input");

	let scan: ScanResult;
	let currentList: NodeInfo[] = [];
	let breadcrumb: NodeInfo[] = [];

	function init(scanRes: ScanResult) {
		$file.hide();
		scan = scanRes;
		currentList = scan.result.children;
		breadcrumb = [scan.result];
		render();
	}

	function render() {
		currentList.sort((a, b) => b.size - a.size);
		$main.children().remove();
		let path = breadcrumb.map((v, idx) => idx === 0 ? scan.root : v.name).join("/");
		$meta.html(`
			<div>Scan of ${scan.root} made on ${scan.date}</div>
			<div>Showing: ${path}
		`);
		if (breadcrumb.length > 1) {
			$main.append(getButton("..", 0, () => {
				breadcrumb.pop();
				currentList = breadcrumb[breadcrumb.length - 1].children;
				render();
			}));
		}
		for (let item of currentList) {
			$main.append(getButton(item.name, item.size, () => {
				if (item.children) {
					breadcrumb.push(item);
					currentList = item.children;
					render();
				}
			}));
		}
	}

	function getButton(name: string, size: number, callback: () => void): JQuery {
		let sizeTxt = displayBytes(size);
		let $button = $(`
			<button class="btn btn-light item-button">
				<div class="name-label">${name}</div>
				<div class="size-label">${sizeTxt}</div>
			</button>
		`);
		$button.on("click", () => callback());
		return $button;
	}

	$file.on("input", () => {
		let files = $file.prop("files");
		let file = files[0];
		if (file) {
			let reader = new FileReader();
			reader.readAsText(file);
			reader.onloadend = e => {
				let json = reader.result as string;
				let scan = JSON.parse(json);
				init(scan);
			}
		}
	});
});