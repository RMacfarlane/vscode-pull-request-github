/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as moment from 'moment';
import md from './mdRenderer';
const emoji = require('node-emoji');

export enum DiffChangeType {
	Context,
	Add,
	Delete,
	Control
}

export class DiffLine {
	public get raw(): string {
		return this._raw;
	}

	public get text(): string {
		return this._raw.substr(1);
	}

	public endwithLineBreak: boolean = true;

	constructor(
		public type: DiffChangeType,
		public oldLineNumber: number, /* 1 based */
		public newLineNumber: number, /* 1 based */
		public positionInHunk: number,
		private _raw: string
	) { }
}

export function getDiffChangeType(text: string) {
	let c = text[0];
	switch (c) {
		case ' ': return DiffChangeType.Context;
		case '+': return DiffChangeType.Add;
		case '-': return DiffChangeType.Delete;
		default: return DiffChangeType.Control;
	}
}

export class DiffHunk {
	public diffLines: DiffLine[] = [];

	constructor(
		public oldLineNumber: number,
		public oldLength: number,
		public newLineNumber: number,
		public newLength: number,
		public positionInHunk: number
	) { }
}
export interface Comment {
	url: string;
	id: string;
	path: string;
	pull_request_review_id: string;
	diff_hunk: string;
	diff_hunks: DiffHunk[];
	position: number;
	original_position: number;
	commit_id: string;
	original_commit_id: string;
	user: User;
	body: string;
	created_at: string;
	updated_at: string;
	html_url: string;
	absolutePosition?: number;
	canEdit: boolean;
	canDelete: boolean;
}

export enum EventType {
	Committed,
	Mentioned,
	Subscribed,
	Commented,
	Reviewed,
	Other
}

export interface Author {
	name: string;
	email: string;
	date: Date;
	login?: string;
	avatar_url?: string;
	html_url?: string;
}

export interface Committer {
	name: string;
	email: string;
	date: Date;
}

export interface Tree {
	sha: string;
	url: string;
}

export interface Parent {
	sha: string;
	url: string;
	html_url: string;
}

export interface Verification {
	verified: boolean;
	reason: string;
	signature?: any;
	payload?: any;
}

export interface User {
	login: string;
	id: number;
	avatar_url: string;
	gravatar_id: string;
	url: string;
	html_url: string;
	followers_url: string;
	following_url: string;
	gists_url: string;
	starred_url: string;
	subscriptions_url: string;
	organizations_url: string;
	repos_url: string;
	events_url: string;
	received_events_url: string;
	type: string;
	site_admin: boolean;
}

export interface Html {
	href: string;
}

export interface PullRequest {
	href: string;
}

export interface Links {
	html: Html;
	pull_request: PullRequest;
}

export interface MentionEvent {
	id: number;
	url: string;
	actor: User;
	event: EventType;
	commit_id: string;
	commit_url: string;
	created_at: Date;
}

export interface SubscribeEvent {
	id: number;
	url: string;
	actor: User;
	event: EventType;
	commit_id: string;
	commit_url: string;
	created_at: Date;
}

export interface CommentEvent {
	url: string;
	html_url: string;
	author: Author;
	user: User;
	created_at: Date;
	updated_at: Date;
	id: number;
	event: EventType;
	actor: User;
	author_association: string;
	body: string;
}

export interface ReviewEvent {
	id: number;
	user: User;
	body: string;
	commit_id: string;
	submitted_at: Date;
	state: string;
	html_url: string;
	pull_request_url: string;
	author_association: string;
	_links: Links;
	event: EventType;
	comments: Comment[];
}

export interface CommitEvent {
	sha: string;
	url: string;
	html_url: string;
	author: Author;
	committer: Committer;
	tree: Tree;
	message: string;
	parents: Parent[];
	verification: Verification;
	event: EventType;
}

export enum PullRequestStateEnum {
	Open,
	Merged,
	Closed,
}

export type TimelineEvent = CommitEvent | ReviewEvent | SubscribeEvent | CommentEvent | MentionEvent;

function groupBy<T>(arr: T[], fn: (el: T) => string): { [key: string]: T[] } {
	return arr.reduce((result, el) => {
		const key = fn(el);
		result[key] = [...(result[key] || []), el];
		return result;
	}, Object.create(null));
}

function renderUserIcon(iconLink: string, iconSrc: string): HTMLElement {
	const iconContainer = document.createElement('div');
	iconContainer.className = 'avatar-container';

	const avatarLink = document.createElement('a');
	avatarLink.className = 'avatar-link';
	(<HTMLAnchorElement>avatarLink).href = iconLink;

	const avatar = document.createElement('img');
	avatar.className = 'avatar';
	(<HTMLImageElement>avatar).src = iconSrc;

	iconContainer.appendChild(avatarLink).appendChild(avatar);

	return iconContainer;
}

export function renderComment(comment: CommentEvent | Comment, postMessage: (args: any) => void): HTMLElement {
	const commentContainer = document.createElement('div');
	commentContainer.classList.add('comment-container', 'comment');
	const userIcon = renderUserIcon(comment.user.html_url, comment.user.avatar_url);
	const reviewCommentContainer = document.createElement('div');
	reviewCommentContainer.className = 'review-comment-container';
	commentContainer.appendChild(userIcon);
	commentContainer.appendChild(reviewCommentContainer);

	const commentHeader = document.createElement('div');
	commentHeader.className = 'review-comment-header';
	const authorLink = document.createElement('a');
	authorLink.className = 'author';
	(<HTMLAnchorElement>authorLink).href = comment.user.html_url;
	authorLink.textContent = comment.user.login;

	const timestamp = document.createElement('div');
	timestamp.className = 'timestamp';
	timestamp.textContent = moment(comment.created_at).fromNow();

	const commentBody = document.createElement('div');
	commentBody.className = 'comment-body';
	commentBody.innerHTML  = md.render(emoji.emojify(comment.body));

	commentHeader.appendChild(authorLink);
	commentHeader.appendChild(timestamp);
	const actions = renderActions(comment as Comment, commentBody, postMessage);
	if (actions) {
		commentHeader.appendChild(actions);
	}

	reviewCommentContainer.appendChild(commentHeader);
	reviewCommentContainer.appendChild(commentBody);

	return commentContainer;
}

function renderActions(comment: Comment, commentBody: HTMLElement, postMessage: (args: any) => void): HTMLElement | undefined {
	if (!comment.canEdit && !comment.canDelete) {
		return undefined;
	}

	const actionBar = document.createElement('div');
	actionBar.className = 'comment-actions';

	if (comment.canEdit) {
		const editButton = document.createElement('button');
		editButton.innerHTML = `<svg class="octicon octicon-pencil" viewBox="0 0 14 16" version="1.1" width="14" height="16" aria-hidden="true">
			<path fill-rule="evenodd" d="M0 12v3h3l8-8-3-3-8 8zm3 2H1v-2h1v1h1v1zm10.3-9.3L12 6 9 3l1.3-1.3a.996.996 0 0 1 1.41 0l1.59 1.59c.39.39.39 1.02 0 1.41z"></path>
		</svg>`;
		editButton.onclick = (e) => {
			editButton.disabled = true;
			const editingContainer = document.createElement('div');
			editingContainer.className = 'editing-form';
			const editingArea = document.createElement('textarea');
			editingArea.value = comment.body;

			commentBody.classList.add('hidden');

			const cancelButton = document.createElement('button');
			cancelButton.textContent = 'Cancel';
			cancelButton.onclick = () => {
				editingContainer.remove();
				commentBody.classList.remove('hidden');
			};

			const updateButton = document.createElement('button');
			updateButton.textContent = 'Update comment';
			updateButton.onclick = () => {
				postMessage({
					command: 'pr.editComment',
					text: editingArea.value
				});

				updateButton.textContent = 'Updating comment...';
				updateButton.disabled = true;
				editButton.disabled = false;
			};

			const buttons = document.createElement('div');
			buttons.className = 'form-actions';
			buttons.appendChild(cancelButton);
			buttons.appendChild(updateButton);

			(<any>editingContainer).append(editingArea, buttons);
			commentBody.parentElement!.appendChild(editingContainer);
			editingArea.focus();
		};

		actionBar.appendChild(editButton);
	}

	if (comment.canDelete) {
		const deleteButton = document.createElement('button');
		deleteButton.innerHTML = `<svg class="octicon octicon-x" viewBox="0 0 12 16" version="1.1" width="12" height="16" aria-hidden="true">
			<path fill-rule="evenodd" d="M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77 4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48L7.48 8z"></path>
		</svg>`;

		deleteButton.addEventListener('click', () => {
			postMessage({
				command: 'pr.delete-comment',
				comment: comment
			});
		});

		actionBar.appendChild(deleteButton);
	}

	return actionBar;
}


export function renderCommit(timelineEvent: CommitEvent): HTMLElement {
	const shaShort = timelineEvent.sha.substring(0, 7);

	const commentContainer = document.createElement('div');
	commentContainer.classList.add('comment-container', 'commit');
	const commitMessage = document.createElement('div');
	commitMessage.className = 'commit-message';

	const commitIcon = document.createElement('span');
	commitIcon.innerHTML = `<svg class="octicon octicon-git-commit" width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path fill-rule="evenodd" clip-rule="evenodd" d="M10.86 3C10.41 1.28 8.86 0 7 0C5.14 0 3.59 1.28 3.14 3H0V5H3.14C3.59 6.72 5.14 8 7 8C8.86 8 10.41 6.72 10.86 5H14V3H10.86V3ZM7 6.2C5.78 6.2 4.8 5.22 4.8 4C4.8 2.78 5.78 1.8 7 1.8C8.22 1.8 9.2 2.78 9.2 4C9.2 5.22 8.22 6.2 7 6.2V6.2Z" transform="translate(0 4)"/>
	</svg>`;

	commitMessage.appendChild(commitIcon);

	const message = document.createElement('div');
	message.className = 'message';
	if (timelineEvent.author.html_url && timelineEvent.author.avatar_url) {
		const userIcon = renderUserIcon(timelineEvent.author.html_url, timelineEvent.author.avatar_url);
		commitMessage.appendChild(userIcon);

		const login = document.createElement('a');
		login.className = 'author';
		(<HTMLAnchorElement>login).href = timelineEvent.author.html_url;
		login.textContent = timelineEvent.author.login!;
		commitMessage.appendChild(login);
		message.textContent = timelineEvent.message;
	} else {
		message.textContent = `${timelineEvent.author.name} ${timelineEvent.message}`;
	}

	commitMessage.appendChild(message);

	const sha = document.createElement('a');
	sha.className = 'sha';
	(<HTMLAnchorElement>sha).href = timelineEvent.html_url;
	sha.textContent = shaShort;

	(<any>commentContainer).append(commitMessage, sha);

	return commentContainer;
}

function getDiffChangeClass(type: DiffChangeType) {
	switch (type) {
		case DiffChangeType.Add:
			return 'add';
		case DiffChangeType.Delete:
			return 'delete';
		case DiffChangeType.Context:
			return 'context';
		case DiffChangeType.Context:
			return 'context';
		default:
			return 'control';
	}
}

export function renderReview(timelineEvent: ReviewEvent, postMessage: (args: any) => void): HTMLElement | undefined {
	if (timelineEvent.state === 'pending') {
		return undefined;
	}

	const commentContainer = document.createElement('div');
	commentContainer.classList.add('comment-container', 'comment');
	const userIcon = renderUserIcon(timelineEvent.user.html_url, timelineEvent.user.avatar_url);
	const reviewCommentContainer = document.createElement('div');
	reviewCommentContainer.className = 'review-comment-container';
	commentContainer.appendChild(userIcon);
	commentContainer.appendChild(reviewCommentContainer);

	const commentHeader = document.createElement('div');
	commentHeader.className = 'review-comment-header';

	const userLogin = document.createElement('a');
	(<HTMLAnchorElement>userLogin).href = timelineEvent.user.html_url;
	userLogin.textContent = timelineEvent.user.login;

	const reviewState = document.createElement('span');
	switch (timelineEvent.state.toLowerCase()) {
		case 'approved':
			reviewState.textContent = ` approved these changes`;
			break;
		case 'commented':
			reviewState.textContent = ` reviewed`;
			break;
		case 'changes_requested':
			reviewState.textContent = ` requested changes`;
			break;
		default:
			break;
	}

	const timestamp = document.createElement('div');
	timestamp.className = 'timestamp';
	timestamp.textContent = moment(timelineEvent.submitted_at).fromNow();

	(<any>commentHeader).append(userLogin, reviewState, timestamp);

	const reviewBody = document.createElement('div');
	reviewBody.className = 'review-body';
	if (timelineEvent.body) {
		reviewBody.innerHTML = md.render(emoji.emojify(timelineEvent.body));
	}

	let commentBody;
	if (timelineEvent.comments) {
		commentBody = document.createElement('div');
		commentBody.className = 'comment-body';
		let groups = groupBy(timelineEvent.comments, comment => comment.path + ':' + (comment.position !== null ? `pos:${comment.position}` : `ori:${comment.original_position}`));

		for (let path in groups) {
			let comments = groups[path];
			let diffView;
			let diffLines: HTMLElement[] = [];
			if (comments && comments.length) {
				for (let i = 0; i < comments[0].diff_hunks.length; i++) {
					diffLines = comments[0].diff_hunks[i].diffLines.slice(-4).map(diffLine => {
						const diffLineElement = document.createElement('div');
						diffLineElement.classList.add('diffLine',  getDiffChangeClass(diffLine.type));

						const oldLineNumber = document.createElement('span');
						oldLineNumber.textContent = diffLine.oldLineNumber > 0 ? diffLine.oldLineNumber.toString() : ' ';
						oldLineNumber.classList.add('lineNumber');

						const newLineNumber = document.createElement('span');
						newLineNumber.textContent = diffLine.newLineNumber > 0 ? diffLine.newLineNumber.toString() : ' ';
						newLineNumber.classList.add('lineNumber');

						const lineContent = document.createElement('span');
						lineContent.textContent = (diffLine as any)._raw;
						lineContent.classList.add('lineContent');

						diffLineElement.appendChild(oldLineNumber);
						diffLineElement.appendChild(newLineNumber);
						diffLineElement.appendChild(lineContent);

						return diffLineElement;
					});
				}

				diffView = document.createElement('div');
				diffView.className = 'diff';
				const diffHeader = document.createElement('div');
				diffHeader.className = 'diffHeader';
				diffHeader.textContent = comments[0].path;

				diffView.appendChild(diffHeader);
				(<any>diffView).append(...diffLines);
			}

			if (diffView) {
				commentBody.appendChild(diffView);
			}

			(<any>commentBody).append(...comments.map(comment => renderComment(comment, postMessage)));
		}
	}

	(<any>reviewCommentContainer).append(commentHeader, reviewBody);

	if (commentBody) {
		reviewCommentContainer.appendChild(commentBody);
	}

	(<any>commentContainer).append(userIcon, reviewCommentContainer);

	return commentContainer;
}

export function renderTimelineEvent(timelineEvent: TimelineEvent, postMessage: (args: any) => void): HTMLElement | undefined {
	switch (timelineEvent.event) {
		case EventType.Committed:
			return renderCommit((<CommitEvent>timelineEvent));
		case EventType.Commented:
			return renderComment((<CommentEvent>timelineEvent), postMessage);
		case EventType.Reviewed:
			return renderReview((<ReviewEvent>timelineEvent), postMessage);
		default:
			return undefined;
	}
}

export function getStatusBGCoor(state: PullRequestStateEnum) {
	if (state === PullRequestStateEnum.Merged) {
		return '#6f42c1';
	} else if (state === PullRequestStateEnum.Open) {
		return '#2cbe4e';
	} else {
		return '#cb2431';
	}
}

export function getStatus(state: PullRequestStateEnum) {
	if (state === PullRequestStateEnum.Merged) {
		return 'Merged';
	} else if (state === PullRequestStateEnum.Open) {
		return 'Open';
	} else {
		return 'Closed';
	}
}