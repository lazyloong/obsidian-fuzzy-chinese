import { App } from "obsidian";

// Empty declaration to allow for css imports
declare module "*.css" {}

declare global {
    var app: App;
}
