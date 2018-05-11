import { WebSearch } from "./web-search";

export interface ConfigOptions {
    applicationFolders: string[];
    autoStartApp: boolean;
    maxSearchResultCount: number;
    rescanInterval: number;
    searchOperatingSystemSettings: boolean;
    searchResultExecutionArgumentFontSize: number;
    searchResultHeight: number;
    searchResultNameFontSize: number;
    showHiddenFiles: boolean;
    userInputHeight: number;
    userInputFontSize: number;
    webSearches: WebSearch[];
    windowWith: number;
}
