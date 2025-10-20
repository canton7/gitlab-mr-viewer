import { browser } from "$app/environment";

export function stripHtml(input: string): string {
    if (browser) {
        const doc = new DOMParser().parseFromString(input, "text/html");
        return doc.body.textContent || "";
    }

    return "";
}
