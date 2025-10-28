<script lang="ts">
    import { JiraTicketIntegration } from "$lib/gitlab/JiraTicketIntegration";
    import type { Activity, MergeRequest } from "$lib/gitlab/Types";
    import MergeRequestInterface from "$lib/components/MergeRequestInterface.svelte";
    import { driver, type Config } from "driver.js";
    import "driver.js/dist/driver.css";
    import { onMount } from "svelte";

    function hoursAgo(hours: number) {
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        let date = new Date();
        date.setHours(date.getHours() - hours);
        return date;
    }

    const ticketIntegration = new JiraTicketIntegration("https://jira.atlassian.com", null, null);

    const assigned: MergeRequest[] = [
        {
            key: "assigned-1",
            type: "assignee",
            title: "ABC-10: Refactor everything",
            webUrl: "https://google.co.uk",
            createdAt: hoursAgo(0),
            updatedAt: hoursAgo(0),
            assigneeName: "Joe Bloggs",
            reviewerName: "Jane Doe",
            reference: "demo!5",
            isApproved: false,
            firstOpenNoteId: null,
            openDiscussions: 0,
            totalDiscussions: 0,
            ciStatus: "running",
            ciUrl: null,
            ticketIntegration: ticketIntegration,
        },
        {
            key: "assigned-2",
            type: "assignee",
            title: "ABC-5: Fix the thing",
            webUrl: "https://google.co.uk",
            createdAt: hoursAgo(24),
            updatedAt: hoursAgo(12),
            assigneeName: "Joe Bloggs",
            reviewerName: "Jane Doe",
            reference: "demo!3",
            isApproved: false,
            firstOpenNoteId: 1,
            openDiscussions: 1,
            totalDiscussions: 2,
            ciStatus: "success",
            ciUrl: "https://google.co.uk",
            ticketIntegration: ticketIntegration,
        },
        {
            key: "assigned-3",
            type: "assignee",
            title: "ABC-3: Get Claude to write my API layer",
            webUrl: "https://google.co.uk",
            createdAt: hoursAgo(24 * 5),
            updatedAt: hoursAgo(24 * 3),
            assigneeName: "Joe Bloggs",
            reviewerName: "Jane Doe",
            reference: "demo!1",
            isApproved: true,
            firstOpenNoteId: null,
            openDiscussions: 0,
            totalDiscussions: 0,
            ciStatus: "failed",
            ciUrl: "https://google.co.uk",
            ticketIntegration: ticketIntegration,
        },
    ];

    const reviewing: MergeRequest[] = [
        {
            key: "reviewing-1",
            type: "reviewer",
            title: "ABC-9: Strip out everything Claude wrote",
            webUrl: "https://google.co.uk",
            createdAt: hoursAgo(3),
            updatedAt: hoursAgo(3),
            assigneeName: "Joe Bloggs",
            reviewerName: "Jane Doe",
            reference: "demo!4",
            isApproved: false,
            firstOpenNoteId: null,
            openDiscussions: 0,
            totalDiscussions: 0,
            ciStatus: "failed",
            ciUrl: "https://google.co.uk",
            ticketIntegration: ticketIntegration,
        },
        {
            key: "reviewing-2",
            type: "reviewer",
            title: "ABC-4: Fix the thing that is broken",
            webUrl: "https://google.co.uk",
            createdAt: hoursAgo(24 * 3),
            updatedAt: hoursAgo(5),
            assigneeName: "Joe Bloggs",
            reviewerName: "Jane Doe",
            reference: "demo!2",
            isApproved: true,
            firstOpenNoteId: null,
            openDiscussions: 0,
            totalDiscussions: 3,
            ciStatus: "success",
            ciUrl: "https://google.co.uk",
            ticketIntegration: ticketIntegration,
        },
    ];

    const activities: Activity[] = [
        {
            key: "reviewing-2-activity-1",
            date: hoursAgo(5),
            url: "https://google.co.uk",
            authorName: "You",
            body: "approved this merge request",
            mergeRequest: reviewing[1],
        },
        {
            key: "reviewing-2-activity-2",
            date: hoursAgo(5),
            url: "https://google.co.uk",
            authorName: "You",
            body: "resolved all threads",
            mergeRequest: reviewing[1],
        },
        {
            key: "reviewing-2-activity-3",
            date: hoursAgo(8),
            url: "https://google.co.uk",
            authorName: "Pipeline",
            body: "succeeded",
            mergeRequest: reviewing[1],
        },
        {
            key: "reviewing-2-activity-4",
            date: hoursAgo(8),
            url: "https://google.co.uk",
            authorName: reviewing[1].assigneeName!,
            body: "added 2 commits",
            mergeRequest: reviewing[1],
        },
        {
            key: "reviewing-2-activity-5",
            date: hoursAgo(12),
            url: "https://google.co.uk",
            authorName: "You",
            body: "added 2 comments",
            mergeRequest: reviewing[1],
        },
        {
            key: "reviewing-2-activity-6",
            date: hoursAgo(3),
            url: "https://google.co.uk",
            authorName: "Pipeline",
            body: "succeeded",
            mergeRequest: reviewing[1],
        },
        {
            key: "reviewing-2-activity-7",
            date: hoursAgo(24 * 3),
            url: "https://google.co.uk",
            authorName: reviewing[1].assigneeName!,
            body: "requested review from You",
            mergeRequest: reviewing[1],
        },
        {
            key: "assigned-3-activity-1",
            date: hoursAgo(3),
            url: "https://google.co.uk",
            authorName: "Pipeline",
            body: "failed",
            mergeRequest: assigned[2],
        },
        {
            key: "assigned-3-activity-2",
            date: hoursAgo(3),
            url: "https://google.co.uk",
            authorName: "You",
            body: "requested review from " + assigned[2].reviewerName,
            mergeRequest: assigned[2],
        },
    ];

    const driverConfig: Config = {
        showProgress: true,
        overlayClickBehavior: "nextStep",
        steps: [
            {
                popover: {
                    description: "This page shows a summary of your open GitLab Merge Requests.",
                },
            },
            {
                element: "[data-helpid='assigned-merge-requests']",
                popover: {
                    description: "Merge Requests which you've been assigned are over here...",
                },
            },
            {
                element: "[data-helpid='reviewing-merge-requests']",
                popover: {
                    description: "... and Merge Requests which you've been given to review are over here.",
                },
            },
            {
                element: "[data-helpid='merge-request-assigned-1']",
                popover: {
                    description: "Each Merge Request has a card showing the title, project, and the overall status.",
                },
            },
            {
                element: "[data-helpid='merge-request-assigned-1'] .title",
                popover: {
                    description:
                        "Click the title (or anywhere on the card) to open the GitLab page. JIRA issues are also linked: click the issue number to go directly to JIRA.",
                },
            },
            {
                element: "[data-helpid='merge-request-assigned-1'] .bubbles",
                popover: {
                    description:
                        "<p>These bubbles show the status of the Merge Request at a glance.</p>" +
                        "<p>They're colour-coded:</p>" +
                        "<ul>" +
                        "<li>Grey: Waiting for other person or CI</li>" +
                        "<li>Blue: I need to do something</li>" +
                        "<li>Red: Something is broken</li>" +
                        "<li>Green: All good</li>" +
                        "</ul>",
                },
            },
            {
                element: "[data-helpid='merge-request-assigned-1'] .ci",
                popover: {
                    description:
                        'The bottom box is CI. This is grey, which means "waiting for CI". You can hover for the full status.',
                },
            },
            {
                element: "[data-helpid='merge-request-assigned-2'] .ci",
                popover: {
                    description:
                        "This one is passing CI, so the bottom box is green: all good. Click to view the CI run.",
                },
            },
            {
                element: "[data-helpid='merge-request-assigned-3'] .ci",
                popover: {
                    description: "This CI is failing. Again, click to view the failure.",
                },
            },
            {
                element: "[data-helpid='merge-request-reviewing-1'] .ci",
                popover: {
                    description:
                        "This CI is also failing, but because you're not the assignee it's not your job to fix it, which makes it gray.",
                },
            },
            {
                element: "[data-helpid='merge-request-assigned-1'] .discussions",
                popover: {
                    description:
                        "The middle box is open discussions. There are no open discussions here, so everything is good and green.",
                },
            },
            {
                element: "[data-helpid='merge-request-reviewing-1'] .discussions",
                popover: {
                    description:
                        "There are no open discussions here either, but because you're reviewing this it's your job to open discussions. Hence it's blue: your action.",
                },
            },
            {
                element: "[data-helpid='merge-request-assigned-2'] .discussions",
                popover: {
                    description: "There's one open discussion here. Hover for details, or click it to view.",
                },
            },
            {
                element: "[data-helpid='merge-request-assigned-1'] .approval",
                popover: {
                    description:
                        "The top box is approvals. This one hasn't been approved, and it's not your job to approve it, hence, gray.",
                },
            },
            {
                element: "[data-helpid='merge-request-reviewing-1'] .approval",
                popover: {
                    description: "This one hasn't been approved and you're reviewing it, so it's blue: your action.",
                },
            },
            {
                element: "[data-helpid='merge-request-reviewing-2'] .approval",
                popover: {
                    description: "This one has been approved: green, all good!",
                },
            },
            {
                element: "[data-helpid='merge-request-assigned-1']",
                popover: {
                    description:
                        "The overall colour of a card reflects the overall status of the Merge Request. There's nothing for you to do here, so it's gray.",
                },
            },
            {
                element: "[data-helpid='merge-request-assigned-2']",
                popover: {
                    description: "There's an open discussion here, so there's something you need to do: blue.",
                },
            },
            {
                element: "[data-helpid='merge-request-assigned-3']",
                popover: {
                    description: "You need to fix the CI on this, so the whole card is red.",
                },
            },
            {
                element: "[data-helpid='activity']",
                popover: {
                    description:
                        "A combined view of all activity across all Merge Requests is down here at the bottom. Assigned activity on the left, review activity on the right.",
                },
            },
            {
                element: "[data-helpid='merge-request-reviewing-2'] .mr-reference",
                popover: {
                    description:
                        "Mouseover this Merge Request ID to filter the activity list to just those for this Merge Request. You can also click it to pin this Merge Request (click again to remove).",
                },
            },
            {
                popover: {
                    description:
                        "<p>And that's it! Have a click around here, then head over to Settings to link up to GitLab.</p>" +
                        "<p>This is a static website which runs entirely in your browser.</p>",
                },
            },
        ],
    };

    onMount(() => {
        const driverObj = driver(driverConfig);
        driverObj.drive();
    });
</script>

<svelte:head>
    <title>Merge Requests - Help</title>
</svelte:head>

<MergeRequestInterface {reviewing} {assigned} {activities} lastSeen={null} isRefreshing={false} refresh={null} />
