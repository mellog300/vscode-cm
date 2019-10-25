'use strict';

Object.defineProperty(exports, "__esModule", { value: true });
import fs = require('fs');
class CmxCompiler {
    constructor(options) {
        this._steps = [];
        this._autoFileSufix = ".cm";
        this._steps.push(new ShortcutCustomExtensionName());
        this._steps.push(new DynamicPackageName());
        this._steps.push(new CustomExtensionName());
        this._steps.push(new ParentPackageName());
        this._steps.push(new RootExtensionPackage());
        this._rootDirectory = options.rootDir;
    }
    get rootDirectory() {
        return this._rootDirectory;
    }
    get customDirectory() {
        return this._rootDirectory + "\\custom";
    }
    compileFile(file) {
        if (!file || !file.endsWith(".cmx")) {
            return file;
        }
        var sourceFile = file;
        var targetFile = file.replace(".cmx", this._autoFileSufix);
        if (fs.existsSync(targetFile)) {
            fs.unlinkSync(targetFile);
        }
        var fileContent = fs.readFileSync(sourceFile, "utf-8");
        for (var i = 0; i < this._steps.length; i++) {
            fileContent = this._steps[i].adjust(fileContent, sourceFile, this);
        }
        if (fileContent) {
            fs.writeFileSync(targetFile, fileContent);
        }
        return targetFile;
    }
    compileAll() {
        this.compileDir(this.customDirectory);
    }
    clean() {
        this.cleanDir(this.customDirectory);
    }
    cleanDir(path) {
        var files = fs.readdirSync(path);
        for (var i in files) {
            var file = path + "\\" + files[i];
            if (file.endsWith(".cmx")) {
                continue;
            }
            var s = fs.statSync(file);
            if (s.isDirectory()) {
                this.cleanDir(file);
            }
            else if (s.isFile() && file.endsWith(this._autoFileSufix)) {
                if (this.hasCmxFor(file)) {
                    fs.unlinkSync(file);
                }
            }
        }
    }
    hasCmxFor(file) {
        return fs.existsSync(file.replace(this._autoFileSufix, ".cmx"));
    }
    compileDir(path) {
        var files = fs.readdirSync(path);
        for (var i in files) {
            var file = path + "\\" + files[i];
            var s = fs.statSync(file);
            if (s.isDirectory()) {
                this.compileDir(file);
            }
            else if (s.isFile()) {
                if (file.endsWith("cmx")) {
                    this.compileFile(file);
                }
            }
        }
    }
}
exports.cmxCompiler = CmxCompiler;
const cmOutputChannel_1 = require("./cmOutputChannel");
const vscode = require("vscode");
class CmxDiagnosticsCollection {
    constructor(dc) {
        this._fs = require('fs');
        this.realDC = dc;
    }
    get name() {
        return this.realDC.name;
    }
    set(first, diagnostics) {
        if (first instanceof vscode.Uri) {
            if (!this.trySetDiagnostics(first, diagnostics)) {
                this.realDC.set(first, diagnostics);
            }
        }
        else {
            this.realDC.set(first);
        }
    }
    trySetDiagnostics(uri, diagnostics) {
        var file = uri.fsPath;
        if (file.endsWith(".cm")) {
            var cmxEquivalent = file.replace(".cm", ".cmx");
            if (fs.existsSync(cmxEquivalent)) {
                uri = vscode.Uri.file(cmxEquivalent);
                vscode.workspace
                    .openTextDocument(cmxEquivalent)
                    .then((doc) => {
                    this.realDC.set(uri, diagnostics);
                });
                return true;
            }
        }
        return false;
    }
    delete(uri) {
        this.realDC.delete(uri);
    }
    clear() {
        this.realDC.clear();
    }
    dispose() {
        this.realDC.dispose();
    }
    forEach(callback, thisArg) {
        this.realDC.forEach(callback, thisArg);
    }
    get(uri) {
        return this.realDC.get(uri);
    }
    has(uri) {
        return this.realDC.has(uri);
    }
}
class CmxOutputChannel extends cmOutputChannel_1.cmOutputChannel {
    constructor(diags, filePath) {
        var a = new CmxDiagnosticsCollection(diags);
        super(a, filePath);
    }
    lineParser(data) {
        var result = super.lineParser(data);
        var newLines = result.newLines.split('\r\n');
        for (var i = 0; i < newLines.length; i++) {
            var line = newLines[i];
            if (line.startsWith("[ERROR")) {
                var lineParts = line.split(":");
                if (lineParts.length === 4) {
                    var fileInfo = lineParts[1];
                    if (fileInfo.endsWith(".cm")) {
                        var file = "C:\\" + fileInfo;
                        var cmxEquivalent = file.replace(".cm", ".cmx");
                        if (fs.existsSync(cmxEquivalent)) {
                            lineParts[1] = fileInfo.replace(".cm", ".cmx");
                            newLines[i] = lineParts.join(":");
                        }
                    }
                }
            }
        }
        result.newLines = newLines.join('\r\n');
        return result;
    }
}
exports.CmxOutputChannel = CmxOutputChannel;
class DynamicPackageName {
    adjust(fileContent, pathToFile, controller) {
        var dir = getDirFrom(controller.rootDirectory, pathToFile);
        fileContent = fileContent.replace(/\$dynamicPackageName/g, dir);
        return fileContent;
    }
}
class ShortcutCustomExtensionName {
    adjust(fileContent, pathToFile, controller) {
        var dir = getDirFrom(controller.rootDirectory, pathToFile);
        var extensionOwner = dir.split('.')[1];
        fileContent = fileContent.replace(/\$\$/g, extensionOwner);
        return fileContent;
    }
}
class CustomExtensionName {
    adjust(fileContent, pathToFile, controller) {
        var dir = getDirFrom(controller.rootDirectory, pathToFile);
        var extensionOwner = dir.split('.')[1];
        fileContent = fileContent.replace(/\$customExtensionName/g, extensionOwner);
        return fileContent;
    }
}
class RootExtensionPackage {
    adjust(fileContent, pathToFile, controller) {
        var dir = getDirFrom(controller.rootDirectory, pathToFile);
        var packageSections = dir.split('.');
        var pkg = packageSections[0] + "." + packageSections[1];
        fileContent = fileContent.replace(/\$rootExtensionPackage/g, pkg);
        return fileContent;
    }
}
class ParentPackageName {
    adjust(fileContent, pathToFile, controller) {
        var dir = getDirFrom(controller.rootDirectory, pathToFile);
        var parentPackage = "";
        var packageParts = dir.split(".");
        if (packageParts.length > 2) {
            for (var i = 0; i < (packageParts.length - 1); i++) {
                parentPackage += ((i > 0) ? "." : "") + packageParts[i];
            }
        }
        else {
            parentPackage = dir;
        }
        fileContent = fileContent.replace(/\$parentPackageName/g, parentPackage);
        return fileContent;
    }
}
function getDirFrom(root, pathToFile) {
    root = (root + "/").replace(/\\/g, "/");
    var replaceDir = new RegExp(root, "ig");
    return pathToFile.substring(0, pathToFile.lastIndexOf("\\"))
        .replace(/\\/g, "/")
        .replace(replaceDir, "")
        .replace(/\//g, ".");
}
//# sourceMappingURL=cmxCompiler.js.map