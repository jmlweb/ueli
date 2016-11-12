import os from 'os';
import fs from 'fs';
import path from 'path';
import levenshtein from 'fast-levenshtein';
import { ipcRenderer } from 'electron';
import SearchService from './js/SearchService';
import InputValidationService from './js/InputValidationService';
import ExecutionService from './js/ExecutionService';

let searchService = new SearchService();
let inputValidationService = new InputValidationService();
let executionService = new ExecutionService();

let selector = {
    content: '.content',
    input: 'input',
    value: '.result-value',
    path: '.result-path',
    inputTypeIcon: '.input-type-icon',
    theme: '#theme'
};

let windowsCommands = searchService.getFilesFromDirectory('C:\\Windows\\System32', '.exe');

let shortCutFileExtension = '.lnk';
let startMenuFolders = [
    os.homedir() + '\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu',
    'C:\\ProgramData\\Microsoft\\Windows\\Start Menu'
];

let fileWatcher = searchService.initializeFileWatcher(startMenuFolders);

let shortCutFiles = searchService.getFilesFromDirectoriesRecursively(startMenuFolders, shortCutFileExtension);

let searchResult = [];
let searchResultIndex = 0;
let maxResultItems = 10;

let configFilePath = './config.json';
let defaultConfig = {
    theme: 'win10'
}

function InitializeElectronizrTheme() {
    if(!fs.existsSync(configFilePath)) {
        fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig));
        ChangeTheme(defaultConfig.theme);
    }
    else {
        fs.readFile(configFilePath, (err, data) => {
            if (err) throw err;
            data = JSON.parse(data);
            ChangeTheme(data.theme);
        });
    }
}

function DisplaySearchResult() {
    if (searchResult === undefined || searchResult.length === 0)
        return;

    if (searchResultIndex < 0)
        searchResultIndex = searchResult.length - 1;
    if (searchResultIndex > searchResult.length - 1)
        searchResultIndex = 0;

    $(selector.value).empty();
    $(selector.value).children('p').removeClass('active');

    for (let i = 0; i < searchResult.length; i++) {
        $(selector.value).append(`<p id="${i}">${searchResult[i].Name}</p>`);
        $(selector.value).find(`#${searchResultIndex}`).addClass('active');
        $(selector.path).html(searchResult[searchResultIndex].Path);
    }

    $(selector.path).html(searchResult[searchResultIndex].Path);
    ResizeWindow();
}

function GetSearchResult(value) {
    if (value === '') return;

    let allShortCuts = shortCutFiles;
    let apps = [];

    for (let shortcut of allShortCuts) {
        let displayName = path.basename(shortcut).replace(shortCutFileExtension, '');
        let fileName = path.basename(shortcut).toLowerCase().replace(shortCutFileExtension, '');
        let weight = GetWeight(fileName, value.toLowerCase());

        if (!StringContainsSubstring(fileName, value)) continue;
        if (SearchResultListContainsValue(apps, displayName)) continue;

        apps.push({
            Name: displayName,
            Path: `"" "${shortcut}"`,
            Weight: weight
        });
    }

    let sortedResult = apps.sort((a, b) => {
        if (a.Weight > b.Weight) return 1;
        if (a.Weight < b.Weight) return -1;
        return 0;
    });

    if (sortedResult.length > maxResultItems) {
        let newResult = [];
        for (let i = 0; i < maxResultItems; i++) {
            if (i == maxResultItems)
                break;
            newResult.push(sortedResult[i]);
        }
        return newResult;
    }

    return sortedResult;
}

function HideMainWindow() {
    ResetGui();
    ipcRenderer.sendSync('hide-main-window');
}

function ResetGui() {
    $(selector.input).val('');
    $(selector.value).empty();
    $(selector.path).empty();
    $(selector.inputTypeIcon).attr('class', 'fa input-type-icon');
}

function GetWeight(stringToSearch, value) {
    let result = [];
    let stringToSearchWords = SplitStringToArray(stringToSearch);
    let valueWords = SplitStringToArray(value);

    for (let word of stringToSearchWords)
        for (let value of valueWords)
            result.push(levenshtein.get(word, value));

    return GetAvg(result);
}

function GetAvg(array) {
    let sum = 0;

    for (let value of array)
        sum = sum + value;

    return sum / array.length;
}

function SplitStringToArray(string) {
    return string.split(/\s+/);
}

function StringContainsSubstring(stringToSearch, substring) {
    let wordsOfSubstring = SplitStringToArray(substring.toLowerCase());
    stringToSearch = stringToSearch.split(' ').join('').toLowerCase();

    for (let word of wordsOfSubstring)
        if (stringToSearch.indexOf(word) === -1)
            return false;

    return true;
}

function SearchResultListContainsValue(list, value) {
    for (let item of list) {
        if (item.Name === value)
            return true;
    }
    return false;
}

function UpdateAppList() {
    shortCutFiles = searchService.getFilesFromDirectoriesRecursively(startMenuFolders, shortCutFileExtension);
}

function ResizeWindow() {
    let height = $(selector.content).height();
    ipcRenderer.sendSync('resize-window', height);
}

function ChangeTheme(name) {
    let currentTheme = JSON.parse(fs.readFileSync(configFilePath)).theme;

    if(currentTheme !== name) {
        fs.writeFileSync(configFilePath, JSON.stringify({theme: name}));
    }

    let stylePath = `./css/${name}-theme.css`;
    $(selector.theme).attr('href', stylePath);
}

function SetInputTypeIcon(input) {
    let icon = $(selector.inputTypeIcon);

    icon.attr('class', 'fa input-type-icon');

    if (inputValidationService.IsValidHttpOrHttpsUrl(input)) {
        icon.addClass('fa-globe');
    }

    if (inputValidationService.IsValidGoogleQuery(input)) {
        icon.addClass('fa-google');
    }

    if (inputValidationService.IsValidWikipediaQuery(input)) {
        icon.addClass('fa-wikipedia-w');
    }

    if (inputValidationService.CouldBeConsoleCommand(input)) {
        icon.addClass('fa-terminal');
    }

    if (inputValidationService.IsValidWindowsPath(input)) {
        icon.addClass('fa-folder-o');
    }
}

function ValidateInputAndExecute(input) {
    if (inputValidationService.IsElectronizrCommand(input)) {
        executionService.HandleElectronizrCommand(input);
        return;
    }

    if (inputValidationService.IsValidGoogleQuery(input)) {
        executionService.HandleGoogleQuery(input)
        return;
    }

    if (inputValidationService.IsValidWikipediaQuery(input)) {
        executionService.HandleWikipediaQuery(input)
        return;
    }

    if (inputValidationService.IsValidHttpOrHttpsUrl(input)) {
        executionService.HandleUrlInput(input);
        return;
    }

    if (inputValidationService.IsValidWindowsPath(input)) {
        executionService.HandleWindowsPathInput(input);
        return;
    }

    if (inputValidationService.IsWindowsCommand(input, windowsCommands)) {
        executionService.HandleWindowsCommand(input);
        return;
    }

    if (searchResult.length > 0) {
        let path = $(selector.path).html();
        executionService.StartProcess(path);
        ResetGui();
        ipcRenderer.sendSync('hide-main-window');
    }
}

fileWatcher.on('change', (file, stat) => {
    UpdateAppList();
});

$(document).ready(InitializeElectronizrTheme());

// Input Text Change
$(selector.input).bind('input propertychange', function () {
    let input = $(this).val();
    searchResultIndex = 0;

    if (input.split(' ').join('') === '') {
        ResetGui();
        return;
    }

    SetInputTypeIcon(input);
    searchResult = GetSearchResult(input);

    if (searchResult === undefined || searchResult.length === 0) {
        $(selector.value).html('');
        $(selector.path).html('');
        return;
    }
    else
        DisplaySearchResult();
});

// Prevent tab and arrow key from modifing input cursor 
$(window).on('keydown', e => {
    if (e.keyCode === 27) {
        ipcRenderer.send('hide-main-window');
    }
    if (e.keyCode === 40 || e.keyCode === 9) {
        e.preventDefault();
    }
    if (e.keyCode == 38) {
        e.preventDefault();
    }
});

// Keyboard Events
$(selector.input).keyup(e => {
    // When user hits enter on keyboard
    if (e.keyCode === 13) {
        let input = $(selector.input).val()
        ValidateInputAndExecute(input);
    }

    // Select Next or Prev Item
    if (e.keyCode === 40 || e.keyCode === 9) {
        searchResultIndex++;
        DisplaySearchResult();
    }
    if (e.keyCode == 38) {
        searchResultIndex--;
        DisplaySearchResult();
    }
});