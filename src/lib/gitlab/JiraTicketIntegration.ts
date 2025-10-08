import { TicketIntegration, type TicketSpan } from "./Types";

const DEFAULT_KEY_REGEX = /\b([A-Z][A-Z_0-9]+-\d+)/;

export class JiraTicketIntegration extends TicketIntegration {
    private _url: string;
    private _issueRegex: string;

    constructor(url: string, issuePrefix: string | null, issueRegex: string | null) {
        super();

        this._url = url;

        issuePrefix ??= "";
        issueRegex ??= DEFAULT_KEY_REGEX.source;
        this._issueRegex = `\\b${issuePrefix}(?<issue>${issueRegex})`;
    }

    protected findMatches(text: string): TicketSpan[] {
        const regex = new RegExp(this._issueRegex, "g");
        let match;
        const result = [];
        while ((match = regex.exec(text)) !== null) {
            const issue = match.groups!["issue"];
            result.push({ text: issue, start: match.index, url: `${this._url}/browse/${issue}` });
        }
        return result;
    }
}
