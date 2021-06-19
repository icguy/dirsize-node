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
$(function () {
    var $main = $("#main");
    var $meta = $("#metadata");
    var $file = $("input");
    var scan;
    var currentList = [];
    var breadcrumb = [];
    function init(scanRes) {
        $file.hide();
        scan = scanRes;
        currentList = scan.result.children;
        breadcrumb = [scan.result];
        render();
    }
    function render() {
        currentList.sort(function (a, b) { return b.size - a.size; });
        $main.children().remove();
        var path = breadcrumb.map(function (v, idx) { return idx === 0 ? scan.root : v.name; }).join("/");
        $meta.html("\n\t\t\t<div>Scan of " + scan.root + " made on " + scan.date + "</div>\n\t\t\t<div>Showing: " + path + "\n\t\t");
        if (breadcrumb.length > 1) {
            $main.append(getButton("..", 0, function () {
                breadcrumb.pop();
                currentList = breadcrumb[breadcrumb.length - 1].children;
                render();
            }));
        }
        var _loop_1 = function (item) {
            $main.append(getButton(item.name, item.size, function () {
                if (item.children) {
                    breadcrumb.push(item);
                    currentList = item.children;
                    render();
                }
            }));
        };
        for (var _i = 0, currentList_1 = currentList; _i < currentList_1.length; _i++) {
            var item = currentList_1[_i];
            _loop_1(item);
        }
    }
    function getButton(name, size, callback) {
        var sizeTxt = displayBytes(size);
        var $button = $("\n\t\t\t<button class=\"btn btn-light item-button\">\n\t\t\t\t<div class=\"name-label\">" + name + "</div>\n\t\t\t\t<div class=\"size-label\">" + sizeTxt + "</div>\n\t\t\t</button>\n\t\t");
        $button.on("click", function () { return callback(); });
        return $button;
    }
    $file.on("input", function () {
        var files = $file.prop("files");
        var file = files[0];
        if (file) {
            var reader_1 = new FileReader();
            reader_1.readAsText(file);
            reader_1.onloadend = function (e) {
                var json = reader_1.result;
                var scan = JSON.parse(json);
                init(scan);
            };
        }
    });
});
