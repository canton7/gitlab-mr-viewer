import type { CommitablePipelineStatus } from "@gitbeaker/rest";

export type GitlabCiStatus = CommitablePipelineStatus | "none";

export type MergeRequestType = "assignee" | "reviewer";

export interface MergeRequest {
    key: string;
    type: MergeRequestType;
    title: string;
    webUrl: string;
    createdAt: Date;
    updatedAt: Date;
    assigneeName: string | null;
    reviewerName: string | null;
    reference: string;
    isApproved: boolean;
    firstOpenNoteId: number | null;
    openDiscussions: number;
    totalDiscussions: number;
    ciStatus: GitlabCiStatus;
    ciLink: string | null;
    ticketIntegration: TicketIntegration;
}

export interface Activity {
    key: string;
    body: string;
    updatedAt: Date;
    noteId: number | null;
    authorName: string;
    mergeRequest: MergeRequest;
}

export interface TicketSpan {
    text: string;
    start: number;
    url: string;
}

export interface LinkSpan {
    text: string;
    url: string | null;
}

export class TicketIntegration {
    protected findMatches(_text: string): TicketSpan[] {
        return [];
    }

    public createLinkParts(text: string, baseUrl: string): LinkSpan[] {
        const matches = this.findMatches(text);
        const result = [];

        const addNonMatch = (start: number, end: number | undefined = undefined) => {
            // Don't count any punctuation at the start/end as part of the link
            const segment = text.substring(start, end);
            const match = segment.match(/^(\W*)(.+?)(\W*)$/);
            if (match![1]) {
                result.push({ text: match![1], url: null });
            }
            result.push({ text: match![2], url: baseUrl });
            if (match![3]) {
                result.push({ text: match![3], url: null });
            }
        };

        let current = 0;
        for (const match of matches) {
            if (match.start > current) {
                addNonMatch(current, match.start);
            }

            current = match.start + match.text.length;
            result.push({ text: text.substring(match.start, current), url: match.url });
        }

        if (current < text.length) {
            addNonMatch(current);
        }

        return result;
    }
}
