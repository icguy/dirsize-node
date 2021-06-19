"use strict";
exports.__esModule = true;
var fs = require("fs");
var readline = require("readline");
function report(path) {
    var streamCols = process.stdout.columns;
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
    var procText = "processing: ";
    process.stdout.write(procText);
    process.stdout.write(path.substr(0, streamCols - procText.length));
}
function iterateDir(path, name) {
    report(path);
    path = path.endsWith("/") ? path : path + "/";
    try {
        var children = fs.readdirSync(path, { withFileTypes: true });
        var files = {
            name: "<files>",
            size: 0
        };
        var subDirs = [];
        for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
            var child = children_1[_i];
            var childPath = path + child.name;
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
            size: subDirs.reduce(function (prev, curr) { return prev + curr.size; }, 0),
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
function displayBytes(bytes) {
    if (bytes < 1024) {
        return bytes.toString();
    }
    bytes = Math.floor(bytes / 1024);
    if (bytes < 1024) {
        return bytes + "k";
    }
    bytes = Math.floor(bytes / 1024);
    if (bytes < 1024) {
        return bytes + "M";
    }
    bytes = Math.floor(bytes / 1024);
    return bytes + "G";
}
var ResultDisplayer = /** @class */ (function () {
    function ResultDisplayer(scan) {
        this.scan = scan;
        this.listOffset = 0;
        this.breadCrumb = [];
        this.cx = 0;
        this.cy = 0;
        this.headerHeight = 3;
    }
    ResultDisplayer.prototype.rows = function () { return process.stdout.rows; };
    ResultDisplayer.prototype.columns = function () { return process.stdout.columns; };
    ResultDisplayer.prototype.currentIndex = function () { return this.cy - this.headerHeight + this.listOffset; };
    ResultDisplayer.prototype.isInLastRow = function () { return this.cy >= this.rows() - 1; };
    ResultDisplayer.prototype.isInFirstRow = function () { return this.cy <= this.headerHeight; };
    ResultDisplayer.prototype.start = function () {
        var _this = this;
        this.currentNode = this.scan.result;
        this.breadCrumb.push(this.currentNode);
        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);
        process.stdin.on('keypress', function (str, key) {
            if (key.ctrl && key.name === 'c') {
                console.clear();
                process.exit();
            }
            else {
                _this.handleKey(key.name);
            }
        });
        this.render();
    };
    ResultDisplayer.prototype.handleKey = function (name) {
        switch (name) {
            case "up":
                this.move(-1);
                break;
            case "down":
                this.move(1);
                break;
            case "left":
            case "escape": this.moveBack();
            case "return": this.moveInto();
        }
    };
    ResultDisplayer.prototype.moveInto = function () {
        var node = this.currentNode.children[this.currentIndex()];
        if (node && node.children) {
            this.breadCrumb.push(node);
            this.render();
        }
    };
    ResultDisplayer.prototype.moveBack = function () {
        if (this.breadCrumb.length > 1) {
            this.breadCrumb.pop();
            this.render();
        }
    };
    ResultDisplayer.prototype.move = function (dy) {
        var nextIdx = this.currentIndex() + dy;
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
    };
    ResultDisplayer.prototype.write = function (txt) {
        var remaining = this.columns() - this.cx;
        if (remaining > 0) {
            var trunc = txt.substr(0, remaining);
            process.stdout.write(trunc);
            this.cx += trunc.length;
        }
    };
    ResultDisplayer.prototype.writeRight = function (txt, padChar) {
        var remaining = this.columns() - this.cx;
        if (remaining > 0) {
            if (txt.length >= remaining) {
                this.write(txt);
            }
            else {
                var toPad = remaining - txt.length;
                this.write((padChar || ".")[0].repeat(toPad));
                this.write(txt);
            }
        }
    };
    ResultDisplayer.prototype.writeLine = function () {
        process.stdout.write("\n");
        this.cx = 0;
        this.cy++;
    };
    ResultDisplayer.prototype.render = function () {
        var _this = this;
        console.clear();
        this.cx = 0;
        this.cy = 0;
        this.write("Scan of " + this.scan.root + " made on " + this.scan.date);
        this.writeLine();
        var path = this.breadCrumb.map(function (v, idx) { return idx === 0 ? _this.scan.root : v.name; }).join("/");
        this.write("Showing: " + path);
        this.writeLine();
        this.writeLine();
        this.renderList();
        this.moveCursor(0, this.headerHeight);
        this.renderCursor();
    };
    ResultDisplayer.prototype.renderList = function () {
        this.moveCursor(0, this.headerHeight);
        for (var i = this.listOffset; i < this.currentNode.children.length; i++) {
            this.renderRow(this.currentNode.children[i]);
            if (!this.isInLastRow()) {
                this.writeLine();
            }
        }
    };
    ResultDisplayer.prototype.renderRow = function (item) {
        this.renderEmptyCursor();
        this.write(" ");
        this.write(item.name);
        this.writeRight(displayBytes(item.size));
    };
    ResultDisplayer.prototype.renderEmptyCursor = function () {
        this.write("   ");
    };
    ResultDisplayer.prototype.renderCursor = function () {
        this.write(" > ");
    };
    ResultDisplayer.prototype.moveCursor = function (x, y) {
        this.cx = x;
        this.cy = y;
        process.stdout.cursorTo(x, y);
    };
    return ResultDisplayer;
}());
function mainScan() {
    var resultFile = process.argv[2];
    var resultJson = fs.readFileSync(resultFile, 'utf8');
    var result = JSON.parse(resultJson);
    var displayer = new ResultDisplayer(result);
    displayer.start();
}
function main() {
    var root = process.argv[2];
    var outFile = process.argv[3];
    var inputOk = root && fs.existsSync(root) && fs.lstatSync(root).isDirectory() && outFile;
    if (!inputOk) {
        console.log("please specify a directory and an output file");
        return;
    }
    var result = iterateDir(root, "<root>");
    var scanResult = {
        root: root,
        date: new Date().toISOString(),
        result: result
    };
    var outData = JSON.stringify(scanResult, undefined, 4);
    if (outFile) {
        fs.writeFileSync(outFile, outData);
    }
    else {
        console.log(outData);
    }
}
main();
// mainScan();
