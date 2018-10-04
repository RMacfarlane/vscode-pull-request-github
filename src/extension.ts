/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import { VSCodeConfiguration } from './authentication/vsConfiguration';
import { Resource } from './common/resources';
import { ReviewManager } from './view/reviewManager';
import { registerCommands } from './commands';
import Logger from './common/logger';
import { PullRequestManager } from './github/pullRequestManager';
import { formatError, isDescendant, filterEvent, onceEvent } from './common/utils';
import { GitExtension, Repository } from './typings/git';
import { Telemetry } from './common/telemetry';
import { handler as uriHandler } from './common/uri';
import { ITelemetry } from './github/interface';

let telemetry: ITelemetry;

async function init(context: vscode.ExtensionContext, repository: Repository): Promise<void> {
	Logger.appendLine('Git repository found, initializing review manager and pr tree view.');

	const configuration = new VSCodeConfiguration();
	await configuration.loadConfiguration();
	configuration.onDidChange(async _ => {
		if (prManager) {
			try {
				await prManager.clearCredentialCache();
				if (repository) {
					repository.status();
				}
			} catch (e) {
				vscode.window.showErrorMessage(formatError(e));
			}
		}
	});

	context.subscriptions.push(configuration.listenForVSCodeChanges());

	context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));

	const prManager = new PullRequestManager(configuration, repository, telemetry);
	const reviewManager = new ReviewManager(context, configuration, repository, prManager, telemetry);
	registerCommands(context, prManager, reviewManager, telemetry);
	telemetry.on('startup');
}

export async function activate(context: vscode.ExtensionContext) {
	// initialize resources
	Resource.initialize(context);

	telemetry = new Telemetry(context);

	const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git').exports;
	const api = gitExtension.getAPI(1);

	Logger.appendLine('Looking for git repository');

	const rootPath = vscode.workspace.rootPath;
	const repository = api.repositories.filter(r => isDescendant(r.rootUri.fsPath, rootPath))[0];

	if (repository) {
		await init(context, repository);
	} else {
		const onDidOpenRelevantRepository = filterEvent(api.onDidOpenRepository, r => isDescendant(r.rootUri.fsPath, rootPath));
		onceEvent(onDidOpenRelevantRepository)(r => init(context, r));
	}
}

export async function deactivate() {
	if (telemetry) {
		await telemetry.shutdown();
	}
}